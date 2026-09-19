import { PrismaClient, QuestionType, DifficultyLevel } from '@prisma/client';

// Adds NCERT-aligned (Class 11-12) syllabus and a deep question bank for
// Physics, Chemistry and Mathematics on top of the base seed. Idempotent:
// chapters/topics are matched by name, questions by deterministic id.
// Question wording is templated demo content built from real NCERT concepts —
// enough volume/variety to generate full mixed papers, not a licensed bank.
const prisma = new PrismaClient();
const INSTITUTE_ID = 'demo-institute-1';

type TopicDef = { name: string; concepts: string[] };
type ChapterDef = { name: string; topics: TopicDef[] };

const SYLLABUS: Record<string, ChapterDef[]> = {
  Physics: [
    { name: 'Units and Measurements', topics: [
      { name: 'SI Units and Dimensions', concepts: ['SI base units and their dimensional formulae', 'checking the correctness of an equation by dimensional analysis', 'significant figures in a measured quantity'] },
      { name: 'Errors in Measurement', concepts: ['absolute, relative and percentage error', 'propagation of error in a sum and in a product', 'least count of vernier callipers and screw gauge'] },
    ] },
    { name: 'Kinematics', topics: [
      { name: 'Motion in a Straight Line', concepts: ['equations of uniformly accelerated motion', 'interpreting position-time and velocity-time graphs', 'relative velocity of two bodies on a line'] },
      { name: 'Projectile Motion', concepts: ['time of flight and maximum height of a projectile', 'horizontal range and the angle for maximum range', 'motion of a projectile fired horizontally from a height'] },
    ] },
    { name: 'Laws of Motion', topics: [
      { name: "Newton's Laws of Motion", concepts: ["Newton's second law and the concept of momentum", 'action-reaction pairs in Newton\'s third law', 'apparent weight of a body in an accelerating lift'] },
      { name: 'Friction', concepts: ['static and kinetic friction and the coefficient of friction', 'motion of a body on a rough inclined plane', 'angle of repose and limiting friction'] },
    ] },
    { name: 'Work, Energy and Power', topics: [
      { name: 'Work-Energy Theorem', concepts: ['work done by a constant and by a variable force', 'the work-energy theorem for a moving body', 'potential energy stored in a stretched spring'] },
      { name: 'Conservation of Energy and Power', concepts: ['conservation of mechanical energy for a falling body', 'elastic and inelastic collisions in one dimension', 'average and instantaneous power'] },
    ] },
    { name: 'Gravitation', topics: [
      { name: 'Universal Law of Gravitation', concepts: ["Newton's law of gravitation and the value of G", 'variation of acceleration due to gravity with height and depth', 'gravitational potential energy of a mass'] },
      { name: 'Orbital Motion and Satellites', concepts: ['orbital velocity of a satellite', 'escape velocity from the surface of the earth', "Kepler's laws of planetary motion"] },
    ] },
    { name: 'Current Electricity', topics: [
      { name: "Ohm's Law and Resistivity", concepts: ["Ohm's law and the V-I characteristic of a conductor", 'drift velocity and the relation of current to it', 'variation of resistivity with temperature'] },
      { name: "Kirchhoff's Laws and Circuits", concepts: ["Kirchhoff's junction and loop rules", 'balance condition of a Wheatstone bridge', 'combination of cells in series and in parallel'] },
    ] },
    { name: 'Ray Optics', topics: [
      { name: 'Reflection and Refraction', concepts: ['laws of reflection at a plane and a spherical mirror', "Snell's law and the refractive index of a medium", 'total internal reflection and the critical angle'] },
      { name: 'Lenses and Optical Instruments', concepts: ["the lens maker's formula and the thin lens equation", 'magnifying power of a simple and a compound microscope', 'dispersion of light through a prism'] },
    ] },
    { name: 'Dual Nature and Atoms', topics: [
      { name: 'Photoelectric Effect', concepts: ["Einstein's photoelectric equation and the work function", 'stopping potential and threshold frequency', 'de Broglie wavelength of a moving particle'] },
      { name: "Bohr's Model of the Atom", concepts: ['energy levels and radius of the hydrogen atom', 'spectral series of hydrogen such as Lyman and Balmer', "limitations of Rutherford's atomic model"] },
    ] },
  ],
  Chemistry: [
    { name: 'Some Basic Concepts of Chemistry', topics: [
      { name: 'Mole Concept', concepts: ["the mole and Avogadro's number", 'molar mass and the number of moles from a given mass', 'percentage composition and empirical formula'] },
      { name: 'Stoichiometry', concepts: ['the limiting reagent in a chemical reaction', 'balancing a chemical equation and mass-mass calculations', 'molarity and molality of a solution'] },
    ] },
    { name: 'Structure of Atom', topics: [
      { name: 'Quantum Numbers and Orbitals', concepts: ['the four quantum numbers and their allowed values', 'shapes of s, p and d orbitals', "Aufbau principle, Pauli's exclusion principle and Hund's rule"] },
      { name: "Bohr's Model and Spectra", concepts: ["Bohr's postulates and the energy of an electron in an orbit", 'the hydrogen emission spectrum and the Rydberg formula', "Heisenberg's uncertainty principle"] },
    ] },
    { name: 'Chemical Bonding', topics: [
      { name: 'Ionic & Covalent Bonds', concepts: ['formation of an ionic bond and lattice enthalpy', 'Lewis structures and the octet rule', 'polarity of a covalent bond and dipole moment'] },
      { name: 'Hybridization', concepts: ['sp, sp2 and sp3 hybridization', 'VSEPR theory and the shapes of molecules', 'molecular orbital theory and bond order'] },
    ] },
    { name: 'Thermodynamics', topics: [
      { name: 'Enthalpy & Entropy', concepts: ['enthalpy of formation and of combustion', "Hess's law of constant heat summation", 'the first law of thermodynamics and internal energy'] },
      { name: 'Gibbs Free Energy', concepts: ['entropy and the second law of thermodynamics', 'Gibbs energy and the criterion of spontaneity', 'the relation between Gibbs energy and the equilibrium constant'] },
    ] },
    { name: 'Equilibrium', topics: [
      { name: 'Chemical Equilibrium', concepts: ["Le Chatelier's principle", 'the equilibrium constants Kc and Kp', 'the reaction quotient and the direction of a reaction'] },
      { name: 'Ionic Equilibrium and pH', concepts: ['pH and pOH of strong and weak acids', 'the common ion effect and buffer solutions', 'solubility product and precipitation'] },
    ] },
    { name: 'Organic Chemistry Basics', topics: [
      { name: 'Nomenclature and Isomerism', concepts: ['IUPAC naming of organic compounds', 'structural isomerism and its types', 'geometrical and optical isomerism'] },
      { name: 'Reaction Mechanisms', concepts: ['inductive, resonance and hyperconjugation effects', 'stability of carbocations and free radicals', 'nucleophilic substitution SN1 and SN2 reactions'] },
    ] },
    { name: 'Electrochemistry', topics: [
      { name: 'Galvanic Cells and Nernst Equation', concepts: ['the Daniell cell and cell notation', 'the Nernst equation and the emf of a cell', 'the electrochemical series'] },
      { name: 'Conductance and Electrolysis', concepts: ["Kohlrausch's law and molar conductivity", "Faraday's laws of electrolysis", 'products of electrolysis of aqueous solutions'] },
    ] },
  ],
  Mathematics: [
    { name: 'Sets and Relations', topics: [
      { name: 'Sets and Operations', concepts: ['union, intersection and complement of sets', 'the cardinality of a union of finite sets', 'the power set and subsets'] },
      { name: 'Relations and Functions', concepts: ['types of relations: reflexive, symmetric and transitive', 'domain and range of a function', 'one-one, onto and inverse functions'] },
    ] },
    { name: 'Algebra', topics: [
      { name: 'Quadratic Equations', concepts: ['the nature of roots using the discriminant', 'the sum and product of roots of a quadratic', 'solving quadratic equations with complex roots'] },
      { name: 'Sequences & Series', concepts: ['the nth term and sum of an arithmetic progression', 'the sum of a geometric progression', 'the relation between AM, GM and HM'] },
    ] },
    { name: 'Trigonometric Functions', topics: [
      { name: 'Trigonometric Identities', concepts: ['sum and difference formulae for sine and cosine', 'multiple and sub-multiple angle formulae', 'the range of trigonometric functions'] },
      { name: 'Trigonometric Equations', concepts: ['the general solution of sin x = k', 'the general solution of cos x = k and tan x = k', 'the principal value of inverse trigonometric functions'] },
    ] },
    { name: 'Permutations and Combinations', topics: [
      { name: 'Counting Principle', concepts: ['the fundamental principle of counting', 'permutations of n distinct objects taken r at a time', 'combinations and the property nCr = nC(n-r)'] },
      { name: 'Binomial Theorem', concepts: ['the general term in a binomial expansion', 'the middle term of a binomial expansion', 'the sum of binomial coefficients'] },
    ] },
    { name: 'Coordinate Geometry', topics: [
      { name: 'Straight Lines', concepts: ['the slope and the equation of a line in different forms', 'the distance of a point from a line', 'the angle between two lines'] },
      { name: 'Circles and Conic Sections', concepts: ['the standard equation of a circle', 'the parabola, its focus and directrix', 'the eccentricity of an ellipse and a hyperbola'] },
    ] },
    { name: 'Calculus', topics: [
      { name: 'Limits & Continuity', concepts: ['evaluating a limit by factorisation and rationalisation', 'the standard limits sin x / x and (e^x - 1) / x', "L'Hopital's rule for indeterminate forms"] },
      { name: 'Derivatives', concepts: ['the derivative from first principles', 'the product, quotient and chain rules', 'maxima and minima using the derivative'] },
    ] },
    { name: 'Integrals', topics: [
      { name: 'Indefinite Integration', concepts: ['standard integrals and integration by substitution', 'integration by parts', 'integration using partial fractions'] },
      { name: 'Definite Integrals and Area', concepts: ['the fundamental theorem of calculus', 'properties of definite integrals', 'the area under a curve'] },
    ] },
    { name: 'Probability', topics: [
      { name: 'Basic Probability', concepts: ['the sample space and the probability of an event', 'the addition theorem of probability', 'independent and mutually exclusive events'] },
      { name: 'Conditional Probability and Bayes Theorem', concepts: ['conditional probability and the multiplication rule', "Bayes' theorem", 'the mean of a probability distribution'] },
    ] },
    { name: 'Vectors and 3D Geometry', topics: [
      { name: 'Vector Algebra', concepts: ['the dot product and the angle between vectors', 'the cross product and the area of a parallelogram', 'the scalar triple product'] },
      { name: 'Three Dimensional Geometry', concepts: ['direction cosines and direction ratios of a line', 'the equation of a plane', 'the distance between two skew lines'] },
    ] },
  ],
};

const MCQ_STEMS = [
  (c: string) => `Which of the following statements about ${c} is correct?`,
  (c: string) => `Which of the following best describes ${c}?`,
  (c: string) => `Identify the correct statement related to ${c}.`,
  (c: string) => `A student studies ${c}. Which conclusion is valid?`,
  (c: string) => `Choose the option that correctly applies ${c}.`,
  (c: string) => `Which of the following is NOT true about ${c}?`,
];
const NUM_STEMS = [
  (c: string) => `Solve a numerical problem based on ${c} and obtain the required value from the given data.`,
  (c: string) => `Using ${c}, calculate the unknown quantity for the values given in the question.`,
  (c: string) => `Apply ${c} to compute the final numerical answer, showing each step.`,
  (c: string) => `A problem is set on ${c}. Determine the numerical result with the correct unit.`,
];
const SHORT_STEMS = [
  (c: string) => `Explain ${c} in brief with a suitable example.`,
  (c: string) => `Write a short note on ${c}.`,
  (c: string) => `State and briefly justify the idea behind ${c}.`,
];
const LONG_STEMS = [
  (c: string) => `Discuss ${c} in detail, including the derivation or reasoning and its applications.`,
  (c: string) => `Derive and explain ${c} with the help of a neat diagram or worked example.`,
];
const DIFFICULTY_SUFFIX: Record<DifficultyLevel, string> = {
  EASY: '',
  MEDIUM: ' Justify your answer.',
  HARD: ' Consider the general case and state any assumptions.',
};

const TYPE_PLAN: { type: QuestionType; count: number; marks: number; stems: ((c: string) => string)[] }[] = [
  { type: QuestionType.MCQ, count: 6, marks: 4, stems: MCQ_STEMS },
  { type: QuestionType.NUMERICAL, count: 4, marks: 4, stems: NUM_STEMS },
  { type: QuestionType.SHORT_ANSWER, count: 3, marks: 5, stems: SHORT_STEMS },
  { type: QuestionType.LONG_ANSWER, count: 2, marks: 10, stems: LONG_STEMS },
];
const DIFFICULTIES = [DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD];

async function main() {
  const teacher = await prisma.user.findFirst({ where: { instituteId: INSTITUTE_ID, role: 'TEACHER' } });
  if (!teacher) throw new Error('Run the base seed first (no teacher found).');

  let newTopics = 0;
  let newQuestions = 0;

  for (const [subjectName, chapters] of Object.entries(SYLLABUS)) {
    const subject = await prisma.subject.upsert({
      where: { instituteId_name: { instituteId: INSTITUTE_ID, name: subjectName } },
      update: {},
      create: { instituteId: INSTITUTE_ID, name: subjectName },
    });

    const conceptByTopicName = new Map<string, string[]>();
    let chapterOrder = 0;
    for (const ch of chapters) {
      chapterOrder += 1;
      let chapter = await prisma.chapter.findFirst({ where: { subjectId: subject.id, name: ch.name, deletedAt: null } });
      if (!chapter) chapter = await prisma.chapter.create({ data: { subjectId: subject.id, name: ch.name, order: chapterOrder } });
      let topicOrder = 0;
      for (const tp of ch.topics) {
        topicOrder += 1;
        const existing = await prisma.topic.findFirst({ where: { chapterId: chapter.id, name: tp.name } });
        if (!existing) {
          await prisma.topic.create({ data: { chapterId: chapter.id, name: tp.name, order: topicOrder } });
          newTopics += 1;
        }
        conceptByTopicName.set(tp.name, tp.concepts);
      }
    }

    // Seed questions for EVERY topic of the subject, including ones from the
    // base seed (their concept list falls back to the topic name).
    const topics = await prisma.topic.findMany({
      where: { chapter: { subjectId: subject.id } },
      include: { chapter: { select: { id: true } } },
    });
    for (const topic of topics) {
      const concepts = conceptByTopicName.get(topic.name) ?? [topic.name];
      const rows: any[] = [];
      for (const diff of DIFFICULTIES) {
        for (const plan of TYPE_PLAN) {
          for (let i = 0; i < plan.count; i++) {
            const concept = concepts[i % concepts.length]!;
            const isMcq = plan.type === QuestionType.MCQ;
            const correct = i % 4;
            rows.push({
              id: `ncert-q-${topic.id}-${diff.toLowerCase()}-${plan.type.toLowerCase()}-${i + 1}`,
              instituteId: INSTITUTE_ID,
              subjectId: subject.id,
              chapterId: topic.chapter.id,
              topicId: topic.id,
              type: plan.type,
              difficulty: diff,
              marks: plan.marks,
              negativeMarks: isMcq ? 1 : 0,
              content: plan.stems[i % plan.stems.length]!(concept) + DIFFICULTY_SUFFIX[diff],
              options: isMcq
                ? [
                    { label: 'A', text: `It follows from the standard NCERT treatment of ${concept}`, isCorrect: correct === 0 },
                    { label: 'B', text: 'It holds only in special cases and not in general', isCorrect: correct === 1 },
                    { label: 'C', text: 'It is independent of the conditions given in the problem', isCorrect: correct === 2 },
                    { label: 'D', text: 'None of the above statements applies', isCorrect: correct === 3 },
                  ]
                : undefined,
              solution: `Worked solution: apply ${concept} step by step using the NCERT method.`,
              isApproved: true,
              createdByUserId: teacher.id,
            });
          }
        }
      }
      const res = await prisma.question.createMany({ data: rows, skipDuplicates: true });
      newQuestions += res.count;
    }
    console.log(`✅ ${subjectName}: ${topics.length} topics in ${chapters.length}+ chapters`);
  }

  console.log(`🎉 NCERT seed done: ${newTopics} new topics, ${newQuestions} new questions.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
