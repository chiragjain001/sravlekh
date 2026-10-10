'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Layers,
  Sparkles,
  RotateCw,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Shuffle,
  Filter,
  ChevronDown,
  Check,
  X,
  Search,
  Atom,
  Flame,
  Calculator,
  Trophy,
  RefreshCw,
  Eye,
  Award,
  BookOpen,
  Zap,
  HelpCircle,
} from 'lucide-react';
import { MarqueeText } from '@/components/ui/MarqueeText';
import { DEFAULT_STUDENT_ENROLLED_SUBJECTS } from '@/lib/student-subjects';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Flashcard {
  id: string;
  frontTitle: string;
  frontSubtitle: string;
  frontPrompt: string;
  backFormula: string;
  backExplanation: string;
  backKeyPoints: string[];
  tag: string;
  difficulty: 'Easy' | 'Medium' | 'High-Yield';
}

export interface FlashcardDeck {
  id: string;
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;
  description: string;
  category: 'Core Formulas' | 'Key Reactions' | 'Math Tricks' | 'Constants & Rules';
  iconType: 'atom' | 'flame' | 'calculator';
  cards: Flashcard[];
}

// ── Comprehensive Curated Decks Data (JEE / Class 11-12) ─────────────────────

const FLASHCARD_DECKS: FlashcardDeck[] = [
  {
    id: 'deck-phy-kinematics',
    title: 'Kinematics & Newton’s Laws',
    subject: 'Physics',
    chapter: 'Mechanics',
    description: 'Equations of motion, projectile formulas, friction coefficients & banking of roads.',
    category: 'Core Formulas',
    iconType: 'atom',
    cards: [
      {
        id: 'pk-1',
        frontTitle: 'Banking of Circular Tracks',
        frontSubtitle: 'Circular Motion & Dynamics',
        frontPrompt: 'What is the optimum speed of a vehicle on a banked road without friction?',
        backFormula: 'v = \\sqrt{r g \\tan\\theta}',
        backExplanation: 'The horizontal component of the normal reaction provides the centripetal force: N sin θ = m v² / r, and N cos θ = mg.',
        backKeyPoints: [
          'If speed v < √(rg tan θ), vehicle tends to slip down',
          'With friction, maximum safe speed is v_max = √[rg (tan θ + μ) / (1 - μ tan θ)]',
        ],
        tag: 'Dynamics',
        difficulty: 'High-Yield',
      },
      {
        id: 'pk-2',
        frontTitle: 'Projectile Maximum Range',
        frontSubtitle: '2D Motion',
        frontPrompt: 'What is the maximum horizontal range on a level ground and the corresponding angle?',
        backFormula: 'R_{max} = \\frac{u^2}{g} \\quad \\text{at } \\theta = 45^\\circ',
        backExplanation: 'R = (u² sin 2θ) / g. Maximum occurs when sin 2θ = 1, so 2θ = 90° ⇒ θ = 45°.',
        backKeyPoints: [
          'Two angles of projection θ and (90° - θ) produce identical ranges for the same initial velocity',
          'At maximum range, maximum height reached is H = R_max / 4',
        ],
        tag: 'Kinematics',
        difficulty: 'Easy',
      },
      {
        id: 'pk-3',
        frontTitle: 'Limiting Static Friction',
        frontSubtitle: 'Laws of Motion',
        frontPrompt: 'State the law of static friction and the angle of repose.',
        backFormula: 'f_s \\le \\mu_s N, \\quad \\tan\\theta_r = \\mu_s',
        backExplanation: 'Static friction is self-adjusting up to limiting friction. Once movement starts, kinetic friction fk = μk N is constant (μk < μs).',
        backKeyPoints: [
          'Friction is independent of apparent area of contact',
          'Angle of friction λ equals angle of repose θ_r: tan λ = μ_s',
        ],
        tag: 'Friction',
        difficulty: 'Medium',
      },
      {
        id: 'pk-4',
        frontTitle: 'Work-Energy Theorem',
        frontSubtitle: 'Work, Energy & Power',
        frontPrompt: 'What is the universal statement of Work-Energy Theorem for all force types?',
        backFormula: 'W_{all} = W_{conservative} + W_{non-cons} + W_{ext} = \\Delta K',
        backExplanation: 'Total work done by all forces acting on a body equals the change in kinetic energy: ΔK = 1/2 m(v² - u²).',
        backKeyPoints: [
          'Valid in inertial frames; add pseudo force work in non-inertial frames',
          'W_conservative = -ΔU (change in potential energy)',
        ],
        tag: 'Work & Energy',
        difficulty: 'High-Yield',
      },
    ],
  },
  {
    id: 'deck-phy-rotation',
    title: 'Rotational Motion & Inertia',
    subject: 'Physics',
    chapter: 'Rigid Body Dynamics',
    description: 'Moments of inertia, parallel/perpendicular axis theorems, torque & angular momentum.',
    category: 'Core Formulas',
    iconType: 'atom',
    cards: [
      {
        id: 'pr-1',
        frontTitle: 'Parallel Axis Theorem',
        frontSubtitle: 'Rotational Inertia',
        frontPrompt: 'State Steiner’s Parallel Axis Theorem for moment of inertia of any rigid body.',
        backFormula: 'I = I_{cm} + M d^2',
        backExplanation: 'The axis must be parallel to the axis passing through the Centre of Mass (CM). d is the perpendicular distance between the axes.',
        backKeyPoints: [
          'I_cm must always be through the exact center of mass',
          'Valid for 1D, 2D, and 3D rigid bodies',
        ],
        tag: 'Rotation',
        difficulty: 'High-Yield',
      },
      {
        id: 'pr-2',
        frontTitle: 'Standard Moment of Inertia Table',
        frontSubtitle: 'Common Shapes',
        frontPrompt: 'What are the moments of inertia for a Solid Cylinder, Solid Sphere, and Thin Ring?',
        backFormula: 'I_{disc} = \\frac{1}{2}MR^2, \\quad I_{sphere} = \\frac{2}{5}MR^2, \\quad I_{ring} = MR^2',
        backExplanation: 'All taken about their central symmetry axis passing through the center of mass.',
        backKeyPoints: [
          'Hollow sphere: I = 2/3 MR²',
          'Rod about one end: I = 1/3 ML²; about center: I = 1/12 ML²',
        ],
        tag: 'Inertia',
        difficulty: 'Medium',
      },
      {
        id: 'pr-3',
        frontTitle: 'Conservation of Angular Momentum',
        frontSubtitle: 'Torque & Angular Momentum',
        frontPrompt: 'Under what condition is angular momentum conserved?',
        backFormula: '\\text{If } \\tau_{ext} = 0 \\implies \\vec{L} = I\\vec{\\omega} = \\text{constant}',
        backExplanation: 'When external torque about an axis is zero, initial angular momentum equals final angular momentum: I₁ ω₁ = I₂ ω₂.',
        backKeyPoints: [
          'If body contracts (I decreases), rotational speed ω must increase',
          'Rotational kinetic energy K_rot = L² / (2I)',
        ],
        tag: 'Angular Momentum',
        difficulty: 'High-Yield',
      },
    ],
  },
  {
    id: 'deck-chem-bonding',
    title: 'Chemical Bonding & Hybridization',
    subject: 'Chemistry',
    chapter: 'Inorganic Chemistry',
    description: 'Steric number formula, molecular shapes, VSEPR theory, dipole moments & bond orders.',
    category: 'Core Formulas',
    iconType: 'flame',
    cards: [
      {
        id: 'cb-1',
        frontTitle: 'Steric Number Hybridization Formula',
        frontSubtitle: 'Chemical Bonding',
        frontPrompt: 'What is the standard formula to find hybridization of a central atom?',
        backFormula: 'H = \\frac{1}{2} \\left[ V + M - C + A \\right]',
        backExplanation: 'V = valence electrons of central atom, M = monovalent atoms attached (H, F, Cl, Br, I), C = cationic charge, A = anionic charge.',
        backKeyPoints: [
          'H = 2 (sp), H = 3 (sp²), H = 4 (sp³), H = 5 (sp³d), H = 6 (sp³d²)',
          'Divalent atoms (like O, S) are NOT counted in M',
        ],
        tag: 'Hybridization',
        difficulty: 'High-Yield',
      },
      {
        id: 'cb-2',
        frontTitle: 'MOT Bond Order Calculation',
        frontSubtitle: 'Molecular Orbital Theory',
        frontPrompt: 'How do you calculate bond order and predict magnetic behavior using MOT?',
        backFormula: '\\text{Bond Order} = \\frac{N_b - N_a}{2}',
        backExplanation: 'Nb = number of bonding electrons, Na = number of anti-bonding electrons. If any unpaired electrons exist, molecule is paramagnetic.',
        backKeyPoints: [
          'O₂ has 16 electrons and is paramagnetic (2 unpaired electrons in π* orbitals)',
          'Higher bond order indicates higher bond strength and shorter bond length',
        ],
        tag: 'MOT',
        difficulty: 'High-Yield',
      },
      {
        id: 'cb-3',
        frontTitle: 'Formal Charge Formula',
        frontSubtitle: 'Lewis Structures',
        frontPrompt: 'What is the formula to calculate the formal charge on any atom in a Lewis structure?',
        backFormula: 'FC = V - L - \\frac{1}{2} S',
        backExplanation: 'V = valence electrons in free atom, L = non-bonding (lone pair) electrons, S = shared (bonding) electrons.',
        backKeyPoints: [
          'Lowest energy structure has formal charges closest to zero',
          'Negative formal charge should reside on the most electronegative atom',
        ],
        tag: 'Lewis Theory',
        difficulty: 'Medium',
      },
    ],
  },
  {
    id: 'deck-chem-equilibrium',
    title: 'Chemical Equilibrium & Thermodynamics',
    subject: 'Chemistry',
    chapter: 'Physical Chemistry',
    description: 'Kp vs Kc relations, Le Chatelier shifts, Gibbs free energy ΔG, and pH buffer equations.',
    category: 'Key Reactions',
    iconType: 'flame',
    cards: [
      {
        id: 'ce-1',
        frontTitle: 'Relationship Between Kp and Kc',
        frontSubtitle: 'Chemical Equilibrium',
        frontPrompt: 'State the exact relation between Kp and Kc for a gaseous reversible reaction.',
        backFormula: 'K_p = K_c (R T)^{\\Delta n_g}',
        backExplanation: 'Δng = moles of gaseous products - moles of gaseous reactants. R = 0.0821 L·atm/(mol·K) or 8.314 J/(mol·K).',
        backKeyPoints: [
          'If Δng = 0, Kp = Kc (independent of pressure and volume)',
          'If Δng > 0, Kp > Kc at standard temperatures',
        ],
        tag: 'Equilibrium',
        difficulty: 'Easy',
      },
      {
        id: 'ce-2',
        frontTitle: 'Gibbs Free Energy & Equilibrium Constant',
        frontSubtitle: 'Thermodynamics',
        frontPrompt: 'What is the thermodynamic link between standard Gibbs free energy and equilibrium constant K?',
        backFormula: '\\Delta G^\\circ = -2.303 R T \\log_{10} K_{eq}',
        backExplanation: 'At equilibrium, ΔG = 0, which leaves ΔG° = -RT ln K. For a spontaneous reaction, ΔG° < 0 so K > 1.',
        backKeyPoints: [
          'Temperature is in Kelvin (T = °C + 273.15)',
          'If ΔH < 0 and ΔS > 0, reaction is spontaneous at all temperatures',
        ],
        tag: 'Thermodynamics',
        difficulty: 'High-Yield',
      },
      {
        id: 'ce-3',
        frontTitle: 'Henderson-Hasselbalch Buffer Equation',
        frontSubtitle: 'Ionic Equilibrium',
        frontPrompt: 'Write the Henderson equation for an acidic buffer solution.',
        backFormula: 'pH = pK_a + \\log_{10} \\left( \\frac{[\\text{Conjugate Base}]}{[\\text{Weak Acid}]} \\right)',
        backExplanation: 'Used for acidic buffers (e.g., CH₃COOH + CH₃COONa). Maximum buffer capacity occurs when [Salt] = [Acid], giving pH = pKa.',
        backKeyPoints: [
          'For basic buffer: pOH = pKb + log([Conjugate Acid] / [Weak Base])',
          'Buffer range is generally pKa ± 1',
        ],
        tag: 'Ionic Equilibrium',
        difficulty: 'Medium',
      },
    ],
  },
  {
    id: 'deck-math-calculus',
    title: 'Differential & Integral Calculus',
    subject: 'Mathematics',
    chapter: 'Calculus',
    description: 'Derivative rules, integration by parts, standard forms, and L’Hôpital’s rule.',
    category: 'Math Tricks',
    iconType: 'calculator',
    cards: [
      {
        id: 'mc-1',
        frontTitle: 'Integration by Parts (ILATE Rule)',
        frontSubtitle: 'Definite & Indefinite Integrals',
        frontPrompt: 'State the Integration by Parts formula and order of function selection.',
        backFormula: '\\int u v \\, dx = u \\int v \\, dx - \\int \\left( \\frac{du}{dx} \\int v \\, dx \\right) dx',
        backExplanation: 'Selection priority for u follows ILATE: Inverse trig > Logarithmic > Algebraic > Trigonometric > Exponential.',
        backKeyPoints: [
          'Special high-yield pattern: ∫ e^x [f(x) + f\'(x)] dx = e^x f(x) + C',
          'Useful for ∫ ln(x) dx by choosing v = 1',
        ],
        tag: 'Integrals',
        difficulty: 'High-Yield',
      },
      {
        id: 'mc-2',
        frontTitle: 'Standard Inverse Trig Derivatives',
        frontSubtitle: 'Differentiation',
        frontPrompt: 'What are the derivatives of arcsin(x), arccos(x), and arctan(x)?',
        backFormula: '\\frac{d}{dx}\\arcsin x = \\frac{1}{\\sqrt{1-x^2}}, \\quad \\frac{d}{dx}\\arctan x = \\frac{1}{1+x^2}',
        backExplanation: 'Note that d/dx [arccos x] = -1 / √(1 - x²). All valid for their respective principal branch domains.',
        backKeyPoints: [
          'd/dx [arcsec x] = 1 / (|x| √(x² - 1))',
          'd/dx [arccot x] = -1 / (1 + x²)',
        ],
        tag: 'Derivatives',
        difficulty: 'Easy',
      },
      {
        id: 'mc-3',
        frontTitle: 'L’Hôpital’s Rule for Indeterminate Forms',
        frontSubtitle: 'Limits & Continuity',
        frontPrompt: 'Under what exact indeterminate forms can L’Hôpital’s Rule be directly applied?',
        backFormula: '\\lim_{x\\to a} \\frac{f(x)}{g(x)} = \\lim_{x\\to a} \\frac{f\'(x)}{g\'(x)} \\quad \\text{for } \\left[\\frac{0}{0}\\right] \\text{ or } \\left[\\frac{\\infty}{\\infty}\\right]',
        backExplanation: 'Differentiate numerator and denominator independently with respect to x. Do NOT apply quotient rule.',
        backKeyPoints: [
          'Must verify limit is strictly 0/0 or ∞/∞ before each differentiation step',
          'Other forms (0·∞, ∞ - ∞, 1^∞, 0⁰) must be converted into 0/0 or ∞/∞ first',
        ],
        tag: 'Limits',
        difficulty: 'High-Yield',
      },
      {
        id: 'mc-4',
        frontTitle: 'Standard Definite Integral Property (King’s Rule)',
        frontSubtitle: 'Definite Integrals',
        frontPrompt: 'State the King’s Rule property of definite integrals.',
        backFormula: '\\int_a^b f(x) \\, dx = \\int_a^b f(a + b - x) \\, dx',
        backExplanation: 'Adding the original integral I to the transformed integral I frequently cancels complex numerators or simplifies denominators to a constant.',
        backKeyPoints: [
          'Special case: ∫₀^a f(x) dx = ∫₀^a f(a - x) dx',
          'Extremely common in JEE Main for symmetry around π/2, π/4',
        ],
        tag: 'Definite Integrals',
        difficulty: 'High-Yield',
      },
    ],
  },
  {
    id: 'deck-math-conics',
    title: 'Coordinate Geometry & Conic Sections',
    subject: 'Mathematics',
    chapter: 'Coordinate Geometry',
    description: 'Parabola, Ellipse, Hyperbola eccentricities, focal radii, tangents & asymptotes.',
    category: 'Core Formulas',
    iconType: 'calculator',
    cards: [
      {
        id: 'cg-1',
        frontTitle: 'Conic Section Eccentricity Definition',
        frontSubtitle: 'Conic Properties',
        frontPrompt: 'Classify conics according to eccentricity e (Circle, Parabola, Ellipse, Hyperbola).',
        backFormula: 'e = 0 \\text{ (Circle)}, \\quad e = 1 \\text{ (Parabola)}, \\quad 0 < e < 1 \\text{ (Ellipse)}, \\quad e > 1 \\text{ (Hyperbola)}',
        backExplanation: 'Eccentricity is the ratio of distance from focus to distance from directrix: SP / PM = e.',
        backKeyPoints: [
          'Rectangular hyperbola has eccentricity e = √2',
          'Pair of straight lines corresponds to e = ∞',
        ],
        tag: 'Conics',
        difficulty: 'Easy',
      },
      {
        id: 'cg-2',
        frontTitle: 'Standard Parabola Formulas (y² = 4ax)',
        frontSubtitle: 'Parabola',
        frontPrompt: 'Give Focus, Directrix equation, and Latus Rectum length for y² = 4ax.',
        backFormula: '\\text{Focus: } (a, 0), \\quad \\text{Directrix: } x = -a, \\quad \\text{Latus Rectum: } 4a',
        backExplanation: 'Vertex is at (0, 0), axis is y = 0. Tangent in slope form: y = mx + a/m (m ≠ 0).',
        backKeyPoints: [
          'Focal distance of any point P(x₁, y₁) is (x₁ + a)',
          'Parametric point coordinates: (at², 2at)',
        ],
        tag: 'Parabola',
        difficulty: 'Medium',
      },
      {
        id: 'cg-3',
        frontTitle: 'Ellipse Eccentricity & Latus Rectum',
        frontSubtitle: 'Ellipse (x²/a² + y²/b² = 1, a > b)',
        frontPrompt: 'What is the eccentricity and latus rectum length of an ellipse with horizontal major axis?',
        backFormula: 'e = \\sqrt{1 - \\frac{b^2}{a^2}}, \\quad \\text{Latus Rectum} = \\frac{2b^2}{a}',
        backExplanation: 'Foci are at (±ae, 0). Directrices are x = ±a/e. Sum of focal distances of any point is constant 2a.',
        backKeyPoints: [
          'Relation: b² = a² (1 - e²)',
          'Auxiliary circle equation is x² + y² = a²',
        ],
        tag: 'Ellipse',
        difficulty: 'High-Yield',
      },
    ],
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export function StudentResources() {
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Interactive Flashcard Player State
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCardIds, setMasteredCardIds] = useState<Set<string>>(new Set());
  const [reviewCardIds, setReviewCardIds] = useState<Set<string>>(new Set());

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard controls for Practice Mode
  useEffect(() => {
    if (!activeDeck) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        handleNextCard();
      } else if (e.key === 'ArrowLeft') {
        handlePrevCard();
      } else if (e.key === '1') {
        handleMarkReview();
      } else if (e.key === '2') {
        handleMarkMastered();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDeck, cardIndex, isFlipped]);

  // Available subjects for dropdown
  const availableSubjects = useMemo(() => {
    const map = new Map<string, number>();
    for (const sub of DEFAULT_STUDENT_ENROLLED_SUBJECTS) {
      map.set(sub, 0);
    }
    for (const deck of FLASHCARD_DECKS) {
      map.set(deck.subject, (map.get(deck.subject) ?? 0) + deck.cards.length);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, []);

  // Filtered Decks
  const filteredDecks = useMemo(() => {
    return FLASHCARD_DECKS.filter((deck) => {
      if (selectedSubject !== 'ALL' && deck.subject.toLowerCase() !== selectedSubject.toLowerCase()) {
        return false;
      }
      if (activeCategory !== 'All' && deck.category !== activeCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = deck.title.toLowerCase().includes(q);
        const matchChapter = deck.chapter.toLowerCase().includes(q);
        const matchCard = deck.cards.some(
          (c) =>
            c.frontTitle.toLowerCase().includes(q) ||
            c.frontPrompt.toLowerCase().includes(q) ||
            c.backFormula.toLowerCase().includes(q) ||
            c.tag.toLowerCase().includes(q),
        );
        if (!matchTitle && !matchChapter && !matchCard) return false;
      }
      return true;
    });
  }, [selectedSubject, activeCategory, searchQuery]);

  // Overall Statistics
  const totalCards = useMemo(
    () => FLASHCARD_DECKS.reduce((acc, d) => acc + d.cards.length, 0),
    [],
  );
  const masteredCount = masteredCardIds.size;
  const masteryPercentage = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  // Deck interaction handlers
  const handleOpenDeck = (deck: FlashcardDeck) => {
    setActiveDeck(deck);
    setCardIndex(0);
    setIsFlipped(false);
  };

  const handleClosePractice = () => {
    setActiveDeck(null);
    setIsFlipped(false);
  };

  const currentCard = activeDeck?.cards[cardIndex];

  const handleNextCard = () => {
    if (!activeDeck) return;
    setIsFlipped(false);
    setCardIndex((prev) => (prev + 1 < activeDeck.cards.length ? prev + 1 : 0));
  };

  const handlePrevCard = () => {
    if (!activeDeck) return;
    setIsFlipped(false);
    setCardIndex((prev) => (prev - 1 >= 0 ? prev - 1 : activeDeck.cards.length - 1));
  };

  const handleMarkMastered = () => {
    if (!currentCard) return;
    setMasteredCardIds((prev) => {
      const next = new Set(prev);
      next.add(currentCard.id);
      return next;
    });
    setReviewCardIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNextCard();
  };

  const handleMarkReview = () => {
    if (!currentCard) return;
    setReviewCardIds((prev) => {
      const next = new Set(prev);
      next.add(currentCard.id);
      return next;
    });
    setMasteredCardIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNextCard();
  };

  const handleShuffleDeck = () => {
    if (!activeDeck) return;
    const shuffled = [...activeDeck.cards].sort(() => Math.random() - 0.5);
    setActiveDeck({ ...activeDeck, cards: shuffled });
    setCardIndex(0);
    setIsFlipped(false);
  };

  const handleQuickRevision = () => {
    // Generate a mixed 10-card deck from high-yield cards
    const allCards = FLASHCARD_DECKS.flatMap((d) => d.cards);
    const highYieldCards = allCards.filter((c) => c.difficulty === 'High-Yield');
    const randomCards = [...highYieldCards].sort(() => Math.random() - 0.5).slice(0, 8);
    const mixedDeck: FlashcardDeck = {
      id: 'deck-quick-mixed',
      title: 'High-Yield Quick Revision',
      subject: 'Physics',
      chapter: 'All Subjects Mixed',
      description: 'Hand-picked formulas and active-recall questions for rapid test prep.',
      category: 'Core Formulas',
      iconType: 'atom',
      cards: randomCards,
    };
    handleOpenDeck(mixedDeck);
  };

  const getSubjectColor = (sub: string) => {
    switch (sub) {
      case 'Physics':
        return {
          badge: 'bg-blue-50 text-blue-700 border-blue-200/80',
          dot: 'bg-blue-500',
          gradient: 'from-blue-600 to-indigo-600',
          iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
        };
      case 'Chemistry':
        return {
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          dot: 'bg-emerald-500',
          gradient: 'from-emerald-600 to-teal-600',
          iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        };
      case 'Mathematics':
        return {
          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
          dot: 'bg-indigo-500',
          gradient: 'from-indigo-600 to-violet-600',
          iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
        };
      default:
        return {
          badge: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-500',
          gradient: 'from-slate-700 to-slate-900',
          iconBg: 'bg-slate-100 text-slate-600 border-slate-200',
        };
    }
  };

  const getDeckIcon = (type: string, subject: string) => {
    if (subject === 'Physics') return <Atom className="w-5 h-5 text-blue-600" />;
    if (subject === 'Chemistry') return <Flame className="w-5 h-5 text-emerald-600" />;
    return <Calculator className="w-5 h-5 text-indigo-600" />;
  };

  return (
    <div className="p-3 sm:p-5 md:p-6 pb-28 sm:pb-8 animate-fadein min-h-full flex flex-col">
      <div className="card shadow-sm border border-slate-100 rounded-3xl w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 bg-white relative">
        {/* ── Main Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-6 border-b border-slate-100 mb-6 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Layers className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[19px] sm:text-[20px] font-bold text-slate-800">
                  Revision Flashcards &amp; Formula Decks
                </h2>
                <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/70">
                  Active Recall Hub
                </span>
              </div>
              <p className="text-[12px] sm:text-[12.5px] text-slate-500">
                Formula cards, reaction cheat sheets &amp; high-yield concept prompts for fast exam revision.
              </p>
            </div>
          </div>

          {/* Quick 2-Minute Revision Trigger Button */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleQuickRevision}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl text-[12.5px] font-bold flex items-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>Quick 2-Min Revision</span>
            </button>
          </div>
        </div>

        {/* ── Stat Highlights Strip ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Cards</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-[20px] font-black text-slate-800">{totalCards}</span>
              <span className="text-[11.5px] font-bold text-slate-400">formulas</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Mastered
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-[20px] font-black text-emerald-700">{masteredCount}</span>
              <span className="text-[11.5px] font-bold text-emerald-600">({masteryPercentage}%)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
              <RotateCw className="w-3.5 h-3.5 text-amber-600" /> Need Review
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-[20px] font-black text-amber-800">{reviewCardIds.size}</span>
              <span className="text-[11.5px] font-bold text-amber-600">to revise</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-indigo-600" /> Recall Rate
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-[20px] font-black text-indigo-800">{masteryPercentage}%</span>
              <span className="text-[11.5px] font-bold text-indigo-600">retention</span>
            </div>
          </div>
        </div>

        {/* ── Toolbar: Subject Filter Dropdown & Search Bar ─────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3.5 mb-5">
          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {['All', 'Core Formulas', 'Key Reactions', 'Math Tricks'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Right Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Apple-Style Subject Dropdown */}
            <div className="relative w-full sm:w-auto" ref={dropdownRef}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="w-full sm:w-[220px] flex items-center justify-between gap-2.5 px-3.5 py-2 bg-slate-100/70 hover:bg-slate-200/60 active:scale-[0.98] text-slate-800 text-[12.5px] font-bold rounded-2xl border border-slate-200/60 transition-all shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">
                      {selectedSubject === 'ALL'
                        ? availableSubjects.length > 0
                          ? `All Subjects (${availableSubjects.length})`
                          : 'All Subjects'
                        : selectedSubject}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                      dropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {selectedSubject !== 'ALL' && (
                  <button
                    onClick={() => setSelectedSubject('ALL')}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex-shrink-0"
                    title="Reset filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Popover */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-[240px] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-2xl p-1.5 z-50 animate-fadein">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
                    Filter by Subject
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubject('ALL');
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12.5px] transition-colors cursor-pointer ${
                      selectedSubject === 'ALL'
                        ? 'bg-rose-50 text-rose-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      All Subjects
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">
                        {availableSubjects.length} subject{availableSubjects.length !== 1 ? 's' : ''}
                      </span>
                      {selectedSubject === 'ALL' && <Check className="w-4 h-4 text-rose-600" />}
                    </div>
                  </button>

                  <div className="h-px bg-slate-100 my-1" />

                  {availableSubjects.map((sub) => {
                    const isSel = selectedSubject.toLowerCase() === sub.name.toLowerCase();
                    return (
                      <button
                        key={sub.name}
                        type="button"
                        onClick={() => {
                          setSelectedSubject(sub.name);
                          setDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12.5px] transition-colors cursor-pointer ${
                          isSel
                            ? 'bg-rose-50 text-rose-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                          <span className="truncate">{sub.name}</span>
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {sub.count > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">
                              {sub.count} cards
                            </span>
                          )}
                          {isSel && <Check className="w-4 h-4 text-rose-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search formulas or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl text-[12.5px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Decks Grid View ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-0.5 mb-2 w-full max-w-full">
          {filteredDecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-200 rounded-3xl text-center px-4">
              <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-[14px] font-bold text-slate-700">No formula decks found</p>
              <p className="text-[12px] text-slate-400 max-w-xs mt-1">
                Try searching for another topic or reset your subject filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDecks.map((deck) => {
                const subColor = getSubjectColor(deck.subject);
                const deckMasteredCount = deck.cards.filter((c) => masteredCardIds.has(c.id)).length;
                const deckProgress = Math.round((deckMasteredCount / deck.cards.length) * 100);

                return (
                  <div
                    key={deck.id}
                    onClick={() => handleOpenDeck(deck)}
                    className="flex flex-col justify-between p-5 rounded-2xl border border-slate-200/70 hover:border-indigo-200 hover:shadow-sm bg-white active:scale-[0.99] transition-all cursor-pointer group shadow-2xs w-full max-w-full overflow-hidden"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border ${subColor.badge}`}>
                            {deck.subject}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600">
                            {deck.chapter}
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                          {getDeckIcon(deck.iconType, deck.subject)}
                        </div>
                      </div>

                      {/* Title */}
                      <div className="mb-2 w-full max-w-full overflow-hidden">
                        <MarqueeText
                          text={deck.title}
                          className="text-[15px] sm:text-[15.5px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors"
                        />
                      </div>

                      {/* Description */}
                      <p className="text-[12px] text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                        {deck.description}
                      </p>
                    </div>

                    {/* Bottom Progress & Action */}
                    <div className="pt-3 border-t border-slate-100 mt-2">
                      <div className="flex items-center justify-between text-[11.5px] font-semibold text-slate-500 mb-1.5">
                        <span>{deck.cards.length} Flashcards</span>
                        <span className="text-indigo-600">{deckProgress}% Mastered</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-3">
                        <div
                          className="h-1.5 rounded-full bg-indigo-600 transition-all duration-500"
                          style={{ width: `${deckProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[12px] font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                        <span>Start Practice</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Active Practice Mode Modal (Apple-style Full Focused Deck Player) ── */}
        {activeDeck && currentCard && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadein">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-100">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 flex-shrink-0 font-bold text-[12px]">
                    {cardIndex + 1}/{activeDeck.cards.length}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13.5px] sm:text-[14px] font-bold text-slate-800 truncate">
                      {activeDeck.title}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {activeDeck.subject} • {activeDeck.chapter}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleShuffleDeck}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                    title="Shuffle Cards"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleClosePractice}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                    title="Close Practice"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Progress Bar in Deck */}
              <div className="w-full bg-slate-100 h-1">
                <div
                  className="bg-indigo-600 h-1 transition-all duration-300"
                  style={{
                    width: `${Math.round(((cardIndex + 1) / activeDeck.cards.length) * 100)}%`,
                  }}
                />
              </div>

              {/* Card Container & Flip View */}
              <div className="p-4 sm:p-7 overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-between">
                {/* 3D Flip Card */}
                <div
                  onClick={() => setIsFlipped((prev) => !prev)}
                  className="w-full min-h-[290px] sm:min-h-[320px] rounded-3xl border-2 border-indigo-100/80 bg-gradient-to-b from-white to-indigo-50/20 p-5 sm:p-8 flex flex-col justify-between cursor-pointer hover:border-indigo-300 transition-all shadow-sm group select-none relative overflow-hidden"
                >
                  {/* Top Card Badges */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                      {currentCard.tag}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold ${
                        currentCard.difficulty === 'High-Yield'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : currentCard.difficulty === 'Medium'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {currentCard.difficulty}
                    </span>
                  </div>

                  {/* Card Content: Front vs Back */}
                  {!isFlipped ? (
                    /* ── FRONT OF CARD ── */
                    <div className="my-auto py-6 text-center animate-fadein">
                      <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                        {currentCard.frontSubtitle}
                      </p>
                      <h3 className="text-[19px] sm:text-[22px] font-extrabold text-slate-800 mb-3">
                        {currentCard.frontTitle}
                      </h3>
                      <p className="text-[14px] sm:text-[15.5px] text-slate-600 max-w-lg mx-auto font-medium leading-relaxed">
                        &ldquo;{currentCard.frontPrompt}&rdquo;
                      </p>
                    </div>
                  ) : (
                    /* ── BACK OF CARD (ANSWER / FORMULA) ── */
                    <div className="my-auto py-4 text-center animate-fadein">
                      <span className="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-2">
                        Formula &amp; Derivation
                      </span>

                      {/* Formula Box */}
                      <div className="p-3.5 bg-slate-900 text-emerald-300 rounded-2xl font-mono text-[16px] sm:text-[18px] font-bold mb-3 shadow-inner tracking-wide">
                        {currentCard.backFormula}
                      </div>

                      <p className="text-[12.5px] sm:text-[13px] text-slate-600 mb-3 max-w-lg mx-auto">
                        {currentCard.backExplanation}
                      </p>

                      {/* Key Conditions / Points */}
                      {currentCard.backKeyPoints.length > 0 && (
                        <div className="bg-white/80 rounded-2xl p-3 border border-slate-200/80 text-left space-y-1.5 max-w-lg mx-auto">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Key Conditions &amp; Exam Tips:
                          </span>
                          {currentCard.backKeyPoints.map((pt, i) => (
                            <p key={i} className="text-[11.5px] text-slate-600 flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                              <span>{pt}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Flip Prompt Helper */}
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-indigo-600 mt-2">
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>{isFlipped ? 'Click to view question' : 'Click card or press Space to reveal formula'}</span>
                  </div>
                </div>

                {/* Rating & Navigation Buttons */}
                <div className="mt-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleMarkReview}
                      className={`py-3 px-4 rounded-2xl border text-[13px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        reviewCardIds.has(currentCard.id)
                          ? 'bg-amber-100 border-amber-300 text-amber-900 ring-2 ring-amber-400'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                    >
                      <RotateCw className="w-4 h-4 text-amber-600" />
                      <span>Need Practice (1)</span>
                    </button>

                    <button
                      onClick={handleMarkMastered}
                      className={`py-3 px-4 rounded-2xl border text-[13px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        masteredCardIds.has(currentCard.id)
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-900 ring-2 ring-emerald-400'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Got It Right (2)</span>
                    </button>
                  </div>

                  {/* Previous / Next Deck Nav */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={handlePrevCard}
                      className="px-3.5 py-2 text-[12px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" /> Previous
                    </button>
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                      Use keyboard arrows (← / →) to navigate
                    </span>
                    <button
                      onClick={handleNextCard}
                      className="px-3.5 py-2 text-[12px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      Next <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
