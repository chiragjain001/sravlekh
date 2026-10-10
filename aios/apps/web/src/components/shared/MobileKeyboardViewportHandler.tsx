'use client';

import { useEffect } from 'react';

/**
 * MobileKeyboardViewportHandler
 *
 * System-wide mobile & tablet virtual keyboard viewport coordinator.
 * Ensures that whenever a user focuses any input, textarea, search box, or
 * form field on mobile/tablet devices:
 *
 * 1. The active typing area and cursor NEVER stay obscured behind the virtual keyboard.
 * 2. Nested scroll containers (modals, dialogs, cards, pages) automatically scroll/shift
 *    upward with comfortable breathing room above the keyboard line.
 * 3. On-screen keyboard "Next / Done" action moves focus seamlessly to the next field
 *    in sequence and scrolls it into view.
 * 4. Assigns dynamic `enterkeyhint` attributes ("next", "search", "done") for native-feeling
 *    keyboard buttons on iOS and Android.
 * 5. Exposes `--keyboard-inset-height` and `.keyboard-open` on `document.body` for CSS adaptation.
 */

function isTouchOrMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch = 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 1024;
  const isTouchQuery = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const isMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ''
  );
  return (hasTouch && isSmallScreen) || isTouchQuery || isMobileUA;
}

function isTextInputElement(
  el: Element | null
): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') {
    const input = el as HTMLInputElement;
    const nonTextTypes = ['checkbox', 'radio', 'hidden', 'button', 'submit', 'reset', 'file'];
    return !nonTextTypes.includes(input.type.toLowerCase());
  }
  return el.getAttribute('contenteditable') === 'true';
}

function bringElementIntoSafeView(el: HTMLElement, smooth = true) {
  if (!el || typeof window === 'undefined') return;

  // Verify element is currently in layout
  if (el.offsetParent === null && el.getClientRects().length === 0) return;

  const vv = window.visualViewport;
  const rect = el.getBoundingClientRect();

  const vvTop = vv ? vv.offsetTop : 0;
  const vvHeight = vv ? vv.height : window.innerHeight;
  const vvBottom = vvTop + vvHeight;

  // Safe area boundaries:
  // At least 70px above virtual keyboard bottom
  // At least 55px below top app header
  const minSafeBottom = vvBottom - 70;
  const minSafeTop = vvTop + 55;

  const isObscured = rect.bottom > minSafeBottom || rect.top < minSafeTop;

  if (isObscured) {
    try {
      el.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'center',
        inline: 'nearest',
      });
    } catch {
      el.scrollIntoView(false);
    }
  }
}

export function MobileKeyboardViewportHandler() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let resizeTimer: any = null;
    let focusTimer1: any = null;
    let focusTimer2: any = null;

    const vv = window.visualViewport;

    // ── 1. Visual Viewport Resizing (Keyboard Open / Close detection) ──────────
    const handleViewportChange = () => {
      if (!vv) return;

      const keyboardInset = Math.max(0, window.innerHeight - vv.height);
      const isKeyboardOpen = keyboardInset > 80;

      if (isKeyboardOpen) {
        document.documentElement.style.setProperty(
          '--keyboard-inset-height',
          `${Math.round(keyboardInset)}px`
        );
        document.body.classList.add('keyboard-open');

        // If an input is currently active, ensure it stays visible
        const active = document.activeElement;
        if (active && isTextInputElement(active)) {
          bringElementIntoSafeView(active as HTMLElement, false);
        }
      } else {
        document.documentElement.style.setProperty('--keyboard-inset-height', '0px');
        document.body.classList.remove('keyboard-open');
      }

      // Keep horizontal drift locked at 0 on iOS
      if (window.scrollX !== 0) {
        window.scrollTo(0, window.scrollY);
      }
    };

    if (vv) {
      vv.addEventListener('resize', handleViewportChange);
      vv.addEventListener('scroll', handleViewportChange);
    }

    // ── 2. Focus In Event (Alignment & EnterKeyHint assignment) ───────────────
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !isTextInputElement(target)) return;

      const isMobile = isTouchOrMobileDevice();

      // Configure native keyboard action hint if not explicitly set
      if (target.tagName.toLowerCase() === 'input' && !target.hasAttribute('enterkeyhint')) {
        const input = target as HTMLInputElement;
        const type = input.type.toLowerCase();
        const placeholder = (input.placeholder || '').toLowerCase();
        const name = (input.name || '').toLowerCase();

        if (type === 'search' || placeholder.includes('search') || name.includes('search')) {
          target.setAttribute('enterkeyhint', 'search');
        } else {
          // Check if there is another field in the form
          const container = target.closest('form, [role="dialog"], .modal, .card') || document.body;
          const fields = Array.from(
            container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
              'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])'
            )
          ).filter(f => f.offsetParent !== null || f.getClientRects().length > 0);

          const idx = fields.indexOf(target as any);
          if (idx >= 0 && idx < fields.length - 1) {
            target.setAttribute('enterkeyhint', 'next');
          } else {
            target.setAttribute('enterkeyhint', 'done');
          }
        }
      }

      if (!isMobile) return;

      // Bring into safe view:
      // Immediate frame
      bringElementIntoSafeView(target, true);

      // Re-align during keyboard slide-up animation (around 140ms and 320ms)
      clearTimeout(focusTimer1);
      clearTimeout(focusTimer2);

      focusTimer1 = setTimeout(() => {
        bringElementIntoSafeView(target, true);
      }, 140);

      focusTimer2 = setTimeout(() => {
        bringElementIntoSafeView(target, true);
      }, 320);
    };

    // ── 3. Next / Enter / Done Navigation on Keyboard Action ──────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;

      const target = e.target as HTMLElement | null;
      if (!target || !isTextInputElement(target)) return;

      // Multiline textareas and contenteditable elements must insert newlines on Enter
      if (target.tagName.toLowerCase() === 'textarea' || target.getAttribute('contenteditable') === 'true') {
        return;
      }

      // Only apply Next navigation on touch/mobile devices or when virtual keyboard is active
      const isMobile = isTouchOrMobileDevice();
      if (!isMobile) return;

      const input = target as HTMLInputElement;
      if (input.type === 'submit' || input.type === 'button' || input.type === 'reset') {
        return;
      }

      // Find enclosing form or dialog or card container
      const container = target.closest('form, [role="dialog"], .modal, .card') || document.body;
      const fields = Array.from(
        container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])'
        )
      ).filter(f => f.offsetParent !== null || f.getClientRects().length > 0);

      const currentIndex = fields.indexOf(input);

      if (currentIndex >= 0 && currentIndex < fields.length - 1) {
        // There is a next input field in sequence!
        const nextField = fields[currentIndex + 1];
        if (nextField) {
          e.preventDefault();
          nextField.focus();

          // Bring the next field smoothly into view
          bringElementIntoSafeView(nextField, true);
          setTimeout(() => {
            bringElementIntoSafeView(nextField, true);
          }, 150);
        }
      } else if (currentIndex === fields.length - 1) {
        // Last field in form
        const form = target.closest('form');
        if (!form) {
          // If not in a form, blur to dismiss keyboard
          target.blur();
        }
        // If in form, default Enter behavior (form submit) proceeds naturally
      }
    };

    // Global event registrations with capture where appropriate
    document.addEventListener('focusin', handleFocusIn, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', handleViewportChange);
        vv.removeEventListener('scroll', handleViewportChange);
      }
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(resizeTimer);
      clearTimeout(focusTimer1);
      clearTimeout(focusTimer2);
      document.body.classList.remove('keyboard-open');
    };
  }, []);

  return null;
}
