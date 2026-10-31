#!/usr/bin/env node
'use strict';

/**
 * AIOS / SARVLEKH — Production Institute & Administrator Onboarding Script
 *
 * Usage:
 *   node scripts/onboard-institute.js \
 *     --name "Delhi Public Academy" \
 *     --short-code "DPA" \
 *     --admin-email "principal@dpa.edu.in" \
 *     [--domain "dpa.edu.in"] \
 *     [--role "ADMIN"]
 *
 * Security Invariants:
 *   - Public email providers (gmail.com, yahoo.com, etc.) are strictly forbidden
 *     in domainAllowlist to prevent unauthorized public logins.
 *   - Administrator accounts must be explicitly allowlisted by full email in allow_list_entries.
 *   - Idempotent: safe to run multiple times without corrupting or duplicating data.
 */

const { PrismaClient, UserRole, InstitutePlan, InstituteStatus } = require('@prisma/client');

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
]);

function parseArgs(argv) {
  const args = {
    name: process.env.INSTITUTE_NAME || null,
    shortCode: process.env.INSTITUTE_SHORT_CODE || null,
    adminEmail: process.env.ADMIN_EMAIL || null,
    domain: process.env.INSTITUTE_DOMAIN || null,
    role: process.env.ADMIN_ROLE || 'ADMIN',
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--name' && i + 1 < argv.length) args.name = argv[++i];
    else if (arg === '--short-code' && i + 1 < argv.length) args.shortCode = argv[++i];
    else if (arg === '--admin-email' && i + 1 < argv.length) args.adminEmail = argv[++i];
    else if (arg === '--domain' && i + 1 < argv.length) args.domain = argv[++i];
    else if (arg === '--role' && i + 1 < argv.length) args.role = argv[++i].toUpperCase();
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.name || !args.adminEmail) {
    console.error('❌ Error: Missing required arguments.');
    console.error('Usage: node scripts/onboard-institute.js --name "<Name>" --admin-email "<email>" [--short-code "<code>"] [--domain "<domain>"] [--role "ADMIN|FOUNDER"]');
    process.exit(1);
  }

  const email = args.adminEmail.trim().toLowerCase();
  const emailParts = email.split('@');
  if (emailParts.length !== 2 || !emailParts[0] || !emailParts[1]) {
    console.error(`❌ Error: Invalid email address format: "${args.adminEmail}"`);
    process.exit(1);
  }

  const emailDomain = emailParts[1].toLowerCase();
  const domainAllowlist = [];

  if (args.domain) {
    const customDomain = args.domain.trim().toLowerCase().replace(/^@/, '');
    if (PUBLIC_EMAIL_DOMAINS.has(customDomain)) {
      console.error(`❌ Security Violation: Public webmail domain "${customDomain}" cannot be added to domainAllowlist.`);
      console.error('   Public domains would permit ANY external user with a webmail address to authenticate.');
      console.error('   Leave --domain empty when using public webmail for individual administrators.');
      process.exit(1);
    }
    domainAllowlist.push(customDomain);
  }

  const role = args.role === 'FOUNDER' ? UserRole.FOUNDER : UserRole.ADMIN;
  const shortCode = (args.shortCode || args.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6)).toUpperCase();

  const prisma = new PrismaClient();

  try {
    console.log('\n======================================================');
    console.log(' AIOS — Institute & Administrator Onboarding');
    console.log('======================================================');
    console.log(`Institute Name : ${args.name}`);
    console.log(`Short Code     : ${shortCode}`);
    console.log(`Admin Email    : ${email}`);
    console.log(`Assigned Role  : ${role}`);
    console.log(`Domain Filter  : ${domainAllowlist.length > 0 ? domainAllowlist.join(', ') : '(None - strict email allowlist only)'}`);
    console.log('------------------------------------------------------');

    // 1. Locate or create Institute (Idempotent lookup)
    let institute = await prisma.institute.findFirst({
      where: {
        OR: [
          { shortCode },
          { name: { equals: args.name, mode: 'insensitive' } },
        ],
      },
    });

    if (institute) {
      console.log(`ℹ️  Found existing institute (ID: ${institute.id}, Name: "${institute.name}"). Preserving configuration.`);
      if (domainAllowlist.length > 0) {
        const mergedDomains = Array.from(new Set([...institute.domainAllowlist, ...domainAllowlist]));
        institute = await prisma.institute.update({
          where: { id: institute.id },
          data: { domainAllowlist: mergedDomains },
        });
      }
    } else {
      console.log('🌱 Creating new institute record...');
      institute = await prisma.institute.create({
        data: {
          name: args.name,
          shortCode,
          plan: InstitutePlan.PRO,
          status: InstituteStatus.ACTIVE,
          domainAllowlist,
        },
      });
      console.log(`✅ Institute created successfully with ID: ${institute.id}`);
    }

    // 2. Authorize exact Admin Email in allow_list_entries
    const allowlistEntry = await prisma.allowListEntry.upsert({
      where: {
        instituteId_email: {
          instituteId: institute.id,
          email,
        },
      },
      update: {
        role,
      },
      create: {
        instituteId: institute.id,
        email,
        role,
      },
    });

    console.log(`✅ Administrator authorized: ${allowlistEntry.email} [${allowlistEntry.role}]`);
    console.log('------------------------------------------------------');
    console.log('🎉 Onboarding completed successfully!');
    console.log(`The administrator can now log in at your production URL via Google OAuth:`);
    console.log(`Email: ${email}`);
    console.log('======================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Onboarding failed:', err);
  process.exit(1);
});

