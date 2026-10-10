# AIOS Academic Data Master Specification & Blueprint
## Complete Data Engineering Standard for K-12 (Classes 8–12) Across Mathematics, Science, Social Science & Artificial Intelligence

> **Document Type:** Canonical Master Data Requirement Specification  
> **Target Consumer:** Claude (Anthropic LLM) / Academic Data Extraction Engines / AIOS Data Ingestion Pipeline  
> **System Compatibility:** AIOS Monorepo (`packages/db/prisma/schema.prisma`, `apps/api`, `apps/web`)  
> **Curriculum Standard:** NCERT / CBSE NEP-2020 Aligned Curriculum (Classes 8, 9, 10, 11, 12)  
> **Version:** 2.0.0 (Production Master)

---

## 1. Executive Summary & Purpose

This master specification defines the **authoritative, complete, and production-ready data requirements** for the AIOS (Academic Intelligence Operating System) platform. It serves as the single source of truth for generating, extracting, structuring, and importing academic content from textbooks (NCERT, NCERT Exemplar, RD Sharma, RS Aggarwal, Lakhmir Singh, All in One, CBSE Official Question Banks) into AIOS.

### The Problem It Solves:
1. **Zero Data Redesign:** Eliminates future schema migrations by modeling Classes 8–12, 50+ subjects, 30+ question types, Bloom's taxonomy, concept prerequisite graphs, and step-marking rubrics from Day 1.
2. **Multi-Paper Variety Without Repetition:** Defines the **Question Family & Variant** framework so personalized and adaptive exams can generate dozens of distinct question sets without exposing students to identical questions.
3. **Turnkey Integration:** Data generated strictly according to this specification can be imported directly into the AIOS PostgreSQL database via Prisma with minimal technical transformation.

---

## 2. AIOS Platform Features Supported by This Data

The data generated from this specification directly powers the following AIOS engine features:

| Platform Feature | Required Data Elements in This Specification |
| :--- | :--- |
| **Question Bank & Search** | Subject, Chapter, Topic, Concept, Question Type, Difficulty, Blooms Level, Tags, Language. |
| **Paper Blueprint Generator** | Marks budgeting, Section partitioning, Bloom's cognitive distribution, Chapter weightages. |
| **Anti-Duplicate Exam Generation** | `QuestionFamily`, `variantType`, SHA-256 `contentHash`, normalized `tokenFingerprint`. |
| **Personalized & Adaptive Testing** | `ConceptPrerequisite` DAG, student mastery back-tracing, `StudentQuestionExposure` anti-fatigue. |
| **Step-Marking & AI Grading** | Structured `rubric` array with point values per step, LaTeX solutions, acceptable alternative answers. |
| **Remedial Practice Engine** | Diagnostic questions, prerequisite mapping, concept hierarchy, hints, and worked solutions. |
| **Historical Paper Immutability** | Point-in-time `QuestionVersion` snapshot pinning on `PaperItem`. |
| **Multi-Discipline Support** | `typePayload` JSONB for chemistry states, physics tolerances, map coordinates, and Python test cases. |

---

## 3. Universal Academic Content Hierarchy

The academic content follows a strictly normalized, 7-level hierarchy. **No class or subject requires a separate table.**

```
[ AcademicBoard ] (e.g., "CBSE", "NCERT")
       │
       ▼
[ GradeLevel ] ("Class 8", "Class 9", "Class 10", "Class 11", "Class 12")
       │
       ▼
[ CurriculumVersion ] ("2024-25", "2025-26", "2026-27 NEP Edition")
       │
       ▼
[ Subject ] (Mathematics, Science, Social Science, Artificial Intelligence, Physics, Chemistry, Biology)
       │
       ▼
[ Unit / Theme ] (e.g., "Unit I: Number Systems", "Unit II: Chemical Substances")
       │
       ▼
[ Chapter ] (Official NCERT Chapter Number and Title)
       │
       ▼
[ Topic ] (Major syllabus section within chapter)
       │
       ▼
[ Concept ] ◀───(ConceptPrerequisite DAG)───▶ [ ConceptPrerequisite ]
       │
       ▼
[ LearningObjective ] (Fine-grained actionable competency outcome code)
       │
       ▼
[ QuestionFamily ] (Anti-duplication container grouping variants)
       │
       ▼
[ Question ] (Individual test item with variant type, difficulty, blooms, rubric, typePayload)
```

---

## 4. Complete Syllabus Scope (Classes 8–12)

### 4.1. Class 8 Full Syllabus Breakdown

#### A. Class 8 Mathematics (NCERT)
- **Unit 1: Number Systems & Arithmetic**
  - **Ch 1: Rational Numbers**: Properties of rational numbers (closure, commutativity, associativity), distributive property, representation on number line, rational numbers between two rational numbers.
- **Unit 2: Algebra**
  - **Ch 2: Linear Equations in One Variable**: Solving linear equations having linear expressions on one side, numbers on the other; solving equations having variable on both sides; word problems (age, perimeter, currency, digits).
  - **Ch 9: Algebraic Expressions and Identities**: Terms, factors, coefficients, monomials, binomials, polynomials; addition and subtraction; multiplication of polynomials; standard identities: $(a+b)^2, (a-b)^2, a^2-b^2, (x+a)(x+b)$.
  - **Ch 14: Factorisation**: Method of common factors, factorisation by regrouping terms, factorisation using identities, division of algebraic expressions.
- **Unit 3: Commercial Mathematics**
  - **Ch 8: Comparing Quantities**: Recalling ratios and percentages, discounts, profit and loss, sales tax/GST, compound interest formula ($A = P(1 + r/100)^n$), compounding annually vs semi-annually.
- **Unit 4: Geometry & Mensuration**
  - **Ch 3: Understanding Quadrilaterals**: Curves, polygons, convex and concave polygons, regular polygons; angle sum property of polygon $((n-2) \times 180^\circ)$; exterior angle sum property ($360^\circ$); properties of parallelogram, rhombus, rectangle, square, trapezium.
  - **Ch 11: Mensuration**: Area of trapezium, area of general quadrilateral, area of special quadrilaterals (rhombus, polygon); surface area and volume of cube, cuboid, cylinder.
- **Unit 5: Exponents & Radicals**
  - **Ch 5: Squares and Square Roots**: Square numbers, properties, Pythagorean triplets; finding square root by prime factorisation and long division method; square roots of decimals.
  - **Ch 6: Cubes and Cube Roots**: Cube numbers, prime factorisation for cube roots.
  - **Ch 12: Exponents and Powers**: Powers with negative exponents, laws of exponents ($a^m \times a^n, a^m/a^n, (a^m)^n, a^0=1$), standard form/scientific notation of very large and very small numbers.
- **Unit 6: Data Handling & Graphs**
  - **Ch 4: Data Handling**: Organizing data, grouping data, histograms, pie charts/circle graphs, chance and probability.
  - **Ch 13: Direct and Inverse Proportions**: Direct proportion ($x/y = k$), inverse proportion ($xy = k$), real-world word problems.
  - **Ch 15: Introduction to Graphs**: Bar graphs, pie graphs, double bar graphs, line graphs, linear graphs, Cartesian coordinates $(x, y)$.

#### B. Class 8 Science (NCERT)
- **Unit 1: Food Production & Microorganisms**
  - **Ch 1: Crop Production and Management**: Agricultural practices: soil preparation, sowing, manures and fertilizers, irrigation (drip and sprinkler), protection from weeds, harvesting, storage, animal husbandry.
  - **Ch 2: Microorganisms: Friend and Foe**: Classification (bacteria, fungi, protozoa, algae), useful microorganisms (curd, bread, antibiotics, vaccines, nitrogen fixation), harmful microorganisms (pathogens, food poisoning, food preservation methods).
- **Unit 2: Materials & Chemical World**
  - **Ch 3: Coal and Petroleum**: Exhaustible and inexhaustible resources, formation and refining of petroleum, coal tar, coal gas, coke, fractional distillation, conservation of fossil fuels.
  - **Ch 4: Combustion and Flame**: Conditions necessary for combustion (ignition temperature, fuel, oxygen), inflammable substances, fire control, types of combustion (rapid, spontaneous, explosion), structure of a flame (zones), calorific value, harmful products of burning.
- **Unit 3: Living World & Conservation**
  - **Ch 5: Conservation of Plants and Animals**: Deforestation causes and consequences, biodiversity, wildlife sanctuaries, national parks, biosphere reserves, Red Data Book, endemic species, migration, reforestation.
  - **Ch 6: Reproduction in Animals**: Modes of reproduction: asexual (budding in hydra, binary fission in amoeba), sexual (male and female reproductive systems), internal and external fertilisation, IVF, metamorphosis (frog, silkworm).
  - **Ch 7: Reaching the Age of Adolescence**: Puberty and adolescence, secondary sexual characteristics, hormones and endocrine glands (pituitary, thyroid, pancreas, adrenal, testes, ovaries), sex determination in humans ($XX$ and $XY$), nutritional needs.
- **Unit 4: Physics: Forces, Pressure, Sound, Light**
  - **Ch 8: Force and Pressure**: Force as push or pull, contact forces (muscular, friction) vs non-contact forces (magnetic, electrostatic, gravitational), pressure ($P = F/A$), atmospheric pressure, liquid pressure.
  - **Ch 9: Friction**: Factors affecting friction, static, sliding, and rolling friction, friction as necessary evil, methods of increasing and reducing friction (lubricants, ball bearings), fluid friction (drag) and streamlining.
  - **Ch 10: Sound**: Production of sound by vibrating objects, propagation through mediums (cannot travel in vacuum), human ear anatomy and hearing mechanism, amplitude, frequency, time period, loudness (dB) and pitch, audible and inaudible sounds, noise pollution.
  - **Ch 11: Chemical Effects of Electric Current**: Conductors and insulators in liquids, electrolysis of water, electroplating process and applications.
  - **Ch 12: Some Natural Phenomena**: Electric charges, charging by rubbing, types of charges and interaction, electroscope, lightning and lightning conductors, earthquakes (causes, seismic focus, epicenter, Richter scale, protection).
  - **Ch 13: Light**: Laws of reflection, regular and diffused reflection, image formed by plane mirror, multiple reflections, kaleidoscope, periscope, dispersion of light, human eye structure and defects, Braille system.

#### C. Class 8 Social Science (NCERT)
- **History: Our Pasts - III**
  - Ch 1: How, When and Where (Periodisation, sources, colonial archives)
  - Ch 2: From Trade to Territory (East India Company, Battle of Plassey, Buxar, Doctrine of Lapse, Subsidiary Alliance)
  - Ch 3: Ruling the Countryside (Permanent Settlement, Mahalwari, Ryotwari, Indigo rebellion / Blue rebellion)
  - Ch 4: Tribals, Dikus and the Vision of a Golden Age (Birsa Munda, shifting cultivation, forest laws)
  - Ch 5: When People Rebel 1857 and After (Causes, leaders: Mangal Pandey, Rani Lakshmibai, Bahadur Shah Zafar, aftermath of 1857)
  - Ch 6: Civilising the "Native", Educating the Nation (Orientalists vs Anglicists, Macaulay's Minute, Wood's Despatch, Tagore's Shantiniketan, Mahatma Gandhi on English education)
  - Ch 7: Women, Caste and Reform (Raja Ram Mohan Roy, Sati abolition, Ishwar Chandra Vidyasagar, Jyotirao Phule, B.R. Ambedkar, Periyar)
  - Ch 8: The Making of the National Movement: 1870s–1947 (Formation of INC, moderates and radicals, Partition of Bengal, Swadeshi, Gandhi's arrival, Khilafat, Non-Cooperation, Civil Disobedience, Quit India, Independence and Partition)
- **Geography: Resources and Development**
  - Ch 1: Resources (Types: Natural, Human-made, Human; Sustainable development principles)
  - Ch 2: Land, Soil, Water, Natural Vegetation and Wildlife Resources (Land use, degradation, soil profile, soil erosion and conservation techniques, water scarcity, rainwater harvesting, wildlife conservation)
  - Ch 3: Agriculture (Types of farming: subsistence, commercial, shifting, nomadic; major crops: rice, wheat, millets, cotton, tea, coffee; agricultural development)
  - Ch 4: Industries (Classification: agro-based, mineral-based, cottage, small/large scale; factors of industrial location; major industrial regions: Iron and Steel at Jamshedpur & Pittsburgh, Cotton textile at Ahmedabad & Osaka, Information Technology at Bengaluru & Silicon Valley)
  - Ch 5: Human Resources (Population distribution, density, population growth factors, birth/death rates, population composition, age-sex pyramid)
- **Civics: Social and Political Life - III**
  - Ch 1: The Indian Constitution (Key features: Federalism, Parliamentary form, Separation of powers, Fundamental Rights, Secularism)
  - Ch 2: Understanding Secularism (Indian secularism vs US secularism, state neutrality)
  - Ch 3: Parliament and the Making of Laws (Role of Parliament, Lok Sabha vs Rajya Sabha, how a bill becomes a law)
  - Ch 4: Judiciary (Structure of courts, independence of judiciary, civil vs criminal law, Public Interest Litigation - PIL)
  - Ch 5: Understanding Marginalisation (Adivasis, Muslims, Scheduled Castes and discrimination)
  - Ch 6: Confronting Marginalisation (Article 15, Article 17, Prevention of Atrocities Act 1989, reservation policy)
  - Ch 7: Public Facilities (Water as fundamental right under Article 21, sanitation, electricity, government role)
  - Ch 8: Law and Social Justice (Minimum wages act, child labor laws, Bhopal gas tragedy and safety standards)

#### D. Class 8 Artificial Intelligence (Foundation Skill)
- **Unit 1: Excite**: Introduction to AI, AI vs Natural Intelligence, smart devices, everyday applications of AI (virtual assistants, recommendations, GPS).
- **Unit 2: Relate**: Interactive AI domains: Computer Vision, Natural Language Processing, Statistical Data.
- **Unit 3: Purpose**: UN Sustainable Development Goals (SDGs) and how AI can solve global challenges (clean water, climate, education).
- **Unit 4: Possibilities & Ethics**: AI careers, algorithmic bias, privacy concerns, future implications.

---

### 4.2. Class 9 Full Syllabus Breakdown

#### A. Class 9 Mathematics (NCERT)
- **Ch 1: Number Systems**: Irrational numbers, real numbers and decimal expansions (terminating, non-terminating recurring), representing numbers on the number line, operations on real numbers, rationalizing denominators, laws of exponents for real numbers.
- **Ch 2: Polynomials**: Polynomials in one variable, zeroes of a polynomial, Factor Theorem, algebraic identities: $(x+y+z)^2, (x \pm y)^3, x^3+y^3+z^3-3xyz$, factorisation of cubic polynomials.
- **Ch 3: Coordinate Geometry**: Cartesian plane, coordinates of a point, quadrants, plotting points on the plane.
- **Ch 4: Linear Equations in Two Variables**: Standard form $ax+by+c=0$, solutions of linear equations (infinitely many), graph of linear equation in two variables.
- **Ch 5: Introduction to Euclid's Geometry**: Axioms and postulates (Euclid's 5 postulates, especially Postulate 5 and equivalents).
- **Ch 6: Lines and Angles**: Basic definitions, intersecting vs non-intersecting lines, linear pair axiom, vertically opposite angles, parallel lines and transversals (alternate, corresponding, interior angles), angle sum property of triangles.
- **Ch 7: Triangles**: Congruence criteria: SAS, ASA, AAS, SSS, RHS; properties of isosceles triangles; inequalities in triangles.
- **Ch 8: Quadrilaterals**: Properties of parallelogram, mid-point theorem and its converse.
- **Ch 9: Circles**: Circles and chords, perpendicular from center to a chord, equal chords and their distances, angle subtended by an arc at the center ($2\theta$), angle in a semicircle ($90^\circ$), cyclic quadrilaterals.
- **Ch 10: Heron's Formula**: Area of a triangle using Heron's formula $A = \sqrt{s(s-a)(s-b)(s-c)}$ where $s = (a+b+c)/2$, application in finding area of quadrilaterals.
- **Ch 11: Surface Areas and Volumes**: Surface areas and volumes of right circular cone, sphere, and hemisphere.
- **Ch 12: Statistics**: Graphical representation of data: bar graphs, histograms (varying and uniform widths), frequency polygons.

#### B. Class 9 Science (NCERT)
- **Physics**:
  - **Ch 7: Motion**: Distance and displacement, speed and velocity, uniform and non-uniform motion, acceleration, distance-time and velocity-time graphs, equations of motion: $v=u+at, s=ut+\frac{1}{2}at^2, v^2-u^2=2as$, uniform circular motion.
  - **Ch 8: Force and Laws of Motion**: Balanced and unbalanced forces, Newton's 1st Law (inertia and mass), Newton's 2nd Law ($F=ma$), impulse, Newton's 3rd Law (action-reaction), conservation of linear momentum ($m_1u_1+m_2u_2 = m_1v_1+m_2v_2$).
  - **Ch 9: Gravitation**: Universal law of gravitation ($F = G\frac{m_1m_2}{r^2}$), acceleration due to gravity ($g = GM/R^2$), free fall, mass vs weight, weight on the Moon ($W_m = \frac{1}{6}W_e$), thrust and pressure, buoyancy, Archimedes' principle, relative density.
  - **Ch 10: Work and Energy**: Scientific conception of work ($W = F \cdot s \cos \theta$), kinetic energy ($E_k = \frac{1}{2}mv^2$), potential energy ($E_p = mgh$), law of conservation of mechanical energy, power ($P = W/t$ in Watts), commercial unit of energy ($1\text{ kWh} = 3.6 \times 10^6\text{ J}$).
  - **Ch 11: Sound**: Production and propagation of sound waves, longitudinal nature, compression and rarefaction, characteristics of sound (wavelength, frequency, amplitude, time period, velocity $v = \nu \lambda$), speed of sound in mediums, reflection of sound, echo calculation ($2d = v \times t$), reverberation, ultrasound applications (SONAR, medical imaging), human ear structure.
- **Chemistry**:
  - **Ch 1: Matter in Our Surroundings**: Physical nature of matter, states of matter (solid, liquid, gas, plasma, Bose-Einstein condensate), change of state (melting, boiling, sublimation, latent heat of fusion and vaporization), evaporation factors, cooling caused by evaporation.
  - **Ch 2: Is Matter Around Us Pure?**: Mixtures (homogeneous vs heterogeneous), solutions, suspensions, colloids (Tyndall effect), concentration of solutions ($\%\text{ by mass/volume}$), separation techniques, physical vs chemical changes.
  - **Ch 3: Atoms and Molecules**: Laws of chemical combination (Law of Conservation of Mass, Law of Constant Proportions), Dalton's atomic theory, atomic mass unit, molecules and ions, polyatomic ions, writing chemical formulas (criss-cross method), molecular mass, formula unit mass.
  - **Ch 4: Structure of the Atom**: Thomson's model, Rutherford's alpha particle scattering experiment and nuclear model, Bohr's model of atom, distribution of electrons in orbits (Bohr-Bury rules $2n^2$), valency, atomic number ($Z$) and mass number ($A$), isotopes and isobars with applications.
- **Biology**:
  - **Ch 5: The Fundamental Unit of Life**: Cell as basic unit, discovery (Hooke, Leeuwenhoek), light microscope vs electron microscope, plasma membrane (diffusion, osmosis: hypotonic, hypertonic, isotonic), cell wall, nucleus (chromosomes, DNA, genes), prokaryotic vs eukaryotic cells, cell organelles: endoplasmic reticulum (RER, SER), Golgi apparatus, lysosomes ("suicide bags"), mitochondria ("powerhouse"), plastids (chloroplasts), vacuoles.
  - **Ch 6: Tissues**: Plant tissues: meristematic (apical, intercalary, lateral/cambium) and permanent (parenchyma, collenchyma, sclerenchyma, xylem, phloem); Animal tissues: epithelial, connective (blood, bone, ligament, tendon, cartilage, areolar, adipose), muscular (striated, smooth, cardiac), nervous tissue (neuron structure).
  - **Ch 12: Improvement in Food Resources**: Crop variety improvement (hybridization, genetic modification for yield, disease resistance), crop production management (nutrients: macronutrients, micronutrients, manures, biofertilizers, irrigation), cropping patterns (mixed, intercropping, crop rotation), crop protection management (weed, insect, disease control, grain storage), animal husbandry (cattle farming, poultry, fish production: capture vs culture, beekeeping).

#### C. Class 9 Social Science (NCERT)
- **History: India and the Contemporary World - I**
  - Ch 1: The French Revolution (Causes, estates, storming of Bastille, Declaration of Rights of Man, Reign of Terror, Robespierre, Directory, rise of Napoleon, abolition of slavery)
  - Ch 2: Socialism in Europe and the Russian Revolution (Liberals, Radicals, Conservatives, Karl Marx, 1905 Revolution, Bloody Sunday, February Revolution 1917, October Bolshevik Revolution, Lenin, Stalin's collectivisation)
  - Ch 3: Nazism and the Rise of Hitler (Weimar Republic problems, Treaty of Versailles, Hitler's rise, Nazi ideology, racial state, Holocaust, youth in Nazi Germany)
  - Ch 4: Forest Society and Colonialism (Deforestation, scientific forestry, Dietrich Brandis, Bastar rebellion, Java Dutch forest laws)
  - Ch 5: Pastoralists in the Modern World (Nomadic pastoralists: Gujjar Bakarwals, Gaddis, Maasai of Africa under colonial restrictions)
- **Geography: Contemporary India - I**
  - Ch 1: India - Size and Location (Latitudinal/longitudinal extent, Standard Meridian $82^\circ 30'\text{E}$, neighboring countries)
  - Ch 2: Physical Features of India (Plate tectonics, Himalayan mountains, Northern plains, Peninsular plateau, Indian desert, Coastal plains, Islands)
  - Ch 3: Drainage (Himalayan rivers: Indus, Ganga, Brahmaputra; Peninsular rivers: Narmada, Tapi, Godavari, Krishna, Kaveri; lakes, economic role of rivers, river pollution)
  - Ch 4: Climate (Factors affecting India's climate, jet streams, monsoon mechanism, El Niño, seasons: winter, summer, advancing monsoon, retreating monsoon, annual rainfall distribution)
  - Ch 5: Natural Vegetation and Wildlife (Tropical evergreen, tropical deciduous, thorn, montane, mangrove forests; wildlife conservation, national parks, biosphere reserves)
  - Ch 6: Population (Size, distribution, population growth and change processes, census, National Population Policy)
- **Political Science: Democratic Politics - I**
  - Ch 1: What is Democracy? Why Democracy? (Definitions, features: free and fair elections, one person one vote one value, rule of law, arguments for and against democracy)
  - Ch 2: Constitutional Design (Democratic constitution in South Africa, why do we need a constitution?, making of Indian Constitution, constituent assembly, guiding values: Preamble)
  - Ch 3: Electoral Politics (Why elections?, electoral competition, electoral constituencies, reserved constituencies, voters' list, model code of conduct, role of Election Commission of India)
  - Ch 4: Working of Institutions (Decision-makers: Parliament, Lok Sabha vs Rajya Sabha, Prime Minister and Council of Ministers, President, Supreme Court and judicial review)
  - Ch 5: Democratic Rights (Life without rights: Guantanamo Bay, Kosovo; Rights in the Indian Constitution: Right to Equality, Freedom, against Exploitation, Freedom of Religion, Cultural and Educational Rights, Constitutional Remedies Article 32, expanding scope of rights)
- **Economics: Understanding Economic Development - I**
  - Ch 1: The Story of Village Palampur (Factors of production: land, labor, capital: fixed and working, human capital; agricultural modernization, green revolution consequences, non-farm activities)
  - Ch 2: People as Resource (Human capital formation, education and health investments, economic activities: primary, secondary, tertiary; market vs non-market activities, unemployment: seasonal, disguised, educated)
  - Ch 3: Poverty as a Challenge (Poverty line determination in India, estimates, vulnerable groups, interstate disparities, global poverty scenario, causes, anti-poverty measures: MGNREGA, PMGY, challenges ahead)
  - Ch 4: Food Security in India (Dimensions of food security: availability, accessibility, affordability; Bengal Famine 1943, Green Revolution, Buffer Stock, Public Distribution System - PDS, ration cards, role of cooperatives like Amul)

#### D. Class 9 Artificial Intelligence (CBSE Subject Code 417)
- **Part A: Employability Skills**: Communication skills, self-management, ICT skills, entrepreneurial skills, green skills.
- **Part B: Subject Specific Skills**:
  - **Unit 1: Introduction to AI**: Excite, Relate, Purpose, Possibilities, AI Ethics (bias, privacy, fairness).
  - **Unit 2: AI Project Cycle**: Problem Scoping (4Ws canvas: Who, What, Where, Why), Data Acquisition (sources, training vs testing data), Data Exploration (visualization, cleaning), Modeling (Rule-based vs Learning-based, Supervised, Unsupervised, Reinforcement Learning), Evaluation.
  - **Unit 3: Neural Networks**: Biological vs artificial neurons, input layer, hidden layers, output layer, perceptron basics.
  - **Unit 4: Introduction to Python**: Syntax, variables, data types (int, float, str, bool, list), conditional statements (`if-else`), loops (`for`, `while`), lists, basic arithmetic algorithms.

---

### 4.3. Class 10 Full Syllabus Breakdown

#### A. Class 10 Mathematics (NCERT)
- **Ch 1: Real Numbers**: Fundamental Theorem of Arithmetic (prime factor trees, unique factorisation), finding HCF and LCM, proving irrationality of $\sqrt{2}, \sqrt{3}, \sqrt{5}, a + b\sqrt{p}$.
- **Ch 2: Polynomials**: Geometrical meaning of zeroes, relationship between zeroes and coefficients of quadratic polynomials ($\alpha + \beta = -b/a, \alpha\beta = c/a$), forming quadratic polynomials from roots.
- **Ch 3: Pair of Linear Equations in Two Variables**: Graphical method of solution, consistency/inconsistency conditions ($a_1/a_2 \neq b_1/b_2$ unique; $a_1/a_2 = b_1/b_2 = c_1/c_2$ infinite; $a_1/a_2 = b_1/b_2 \neq c_1/c_2$ no solution), algebraic methods: substitution method, elimination method, word problems (speed/distance/upstream-downstream, age, fraction, geometry).
- **Ch 4: Quadratic Equations**: Standard form $ax^2+bx+c=0$ ($a \neq 0$), solution by factorisation, solution by quadratic formula:
  $$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
  Discriminant $D = b^2 - 4ac$ and nature of roots ($D > 0$ two distinct real roots, $D = 0$ two equal real roots, $D < 0$ no real roots), real-world word problems.
- **Ch 5: Arithmetic Progressions**: Definition of AP, common difference $d$, general term $a_n = a + (n-1)d$, sum of first $n$ terms $S_n = \frac{n}{2}[2a + (n-1)d] = \frac{n}{2}[a + l]$, practical applications.
- **Ch 6: Triangles**: Similar figures vs congruent figures, Basic Proportionality Theorem (Thales' Theorem) and its converse, criteria for similarity of triangles: AAA, SSS, SAS.
- **Ch 7: Coordinate Geometry**: Distance formula $d = \sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$, section formula for internal division:
  $$P(x,y) = \left( \frac{m_1x_2 + m_2x_1}{m_1+m_2}, \frac{m_1y_2 + m_2y_1}{m_1+m_2} \right)$$
  Midpoint formula, collinearity of three points.
- **Ch 8: Introduction to Trigonometry**: Trigonometric ratios (sine, cosine, tangent, cosecant, secant, cotangent) in a right triangle, values for $0^\circ, 30^\circ, 45^\circ, 60^\circ, 90^\circ$, trigonometric identities:
  $$\sin^2 \theta + \cos^2 \theta = 1, \quad 1 + \tan^2 \theta = \sec^2 \theta, \quad 1 + \cot^2 \theta = \csc^2 \theta$$
- **Ch 9: Some Applications of Trigonometry (Heights and Distances)**: Line of sight, angle of elevation, angle of depression, solving multi-triangle real-world scenarios with 1 or 2 right-angled triangles using $30^\circ, 45^\circ, 60^\circ$.
- **Ch 10: Circles**: Tangent to a circle at any point is perpendicular to the radius through the point of contact; lengths of tangents drawn from an external point to a circle are equal.
- **Ch 11: Areas Related to Circles**: Perimeter and area of a circle review, area of sector of a circle of angle $\theta$: $A = \frac{\theta}{360^\circ} \times \pi r^2$, length of an arc: $L = \frac{\theta}{360^\circ} \times 2\pi r$, area of segment of a circle (major and minor).
- **Ch 12: Surface Areas and Volumes**: Surface areas and volumes of combinations of solids: cuboid, cone, cylinder, hemisphere, sphere; conversion of solid from one shape to another.
- **Ch 13: Statistics**: Mean of grouped data (Direct method, Assumed Mean method), Mode of grouped data ($l + \left(\frac{f_1-f_0}{2f_1-f_0-f_2}\right)h$), Median of grouped data ($l + \left(\frac{n/2 - cf}{f}\right)h$), empirical relationship:
  $$\text{Mode} = 3\\text{Median} - 2\\text{Mean}$$
- **Ch 14: Probability**: Classical definition of probability $P(E) = \frac{\text{favourable outcomes}}{\text{total outcomes}}$, elementary events, sum of probabilities $= 1$, impossible event ($P=0$), sure event ($P=1$), coin tosses, dice, standard deck of 52 playing cards.

#### B. Class 10 Science (NCERT)
- **Chemistry**:
  - **Ch 1: Chemical Reactions and Equations**: Chemical equation writing, balancing chemical equations, types of chemical reactions: combination, decomposition (thermal, electrolytic, photolytic), displacement, double displacement (precipitation, neutralization), oxidation and reduction (redox), oxidizing and reducing agents, everyday redox: corrosion and rancidity.
  - **Ch 2: Acids, Bases and Salts**: Chemical properties (reaction with metals, metal carbonates, metal oxides), neutralization, indicators (litmus, phenolphthalein, methyl orange, olfactory), pH scale, importance of pH in everyday life (digestive system, tooth decay, soil pH, acid rain), common salts: Sodium chloride, Sodium hydroxide (Chlor-alkali process), Bleaching powder ($\text{CaOCl}_2$), Baking soda ($\text{NaHCO}_3$), Washing soda ($\text{Na}_2\text{CO}_3\cdot 10\text{H}_2\text{O}$), Plaster of Paris ($\text{CaSO}_4\cdot \frac{1}{2}\text{H}_2\text{O}$) and Gypsum.
  - **Ch 3: Metals and Non-Metals**: Physical and chemical properties of metals and non-metals, reactivity series, reaction of metals with oxygen, water, acids, and salt solutions, ionic bonds and properties of ionic compounds, metallurgy: extraction of metals (low, medium, high reactivity), roasting and calcination, electrolytic refining of copper, corrosion prevention.
  - **Ch 4: Carbon and Its Compounds**: Covalent bonding, tetravalency and catenation, allotropes of carbon (diamond, graphite, fullerenes), saturated and unsaturated hydrocarbons (alkanes, alkenes, alkynes), functional groups (halogen, alcohol, aldehyde, ketone, carboxylic acid), homologous series and nomenclature, chemical properties of carbon compounds: combustion, oxidation, addition reaction, substitution reaction, important carbon compounds: Ethanol ($\text{C}_2\text{H}_5\text{OH}$) and Ethanoic acid ($\text{CH}_3\text{COOH}$), soaps and detergents (micelle formation, cleansing action, hard water reaction).
- **Biology**:
  - **Ch 5: Life Processes**:
    - Nutrition: Autotrophic (photosynthesis mechanism, stomata, light and dark reactions) and Heterotrophic (amoeba, human alimentary canal, digestive enzymes).
    - Respiration: Aerobic vs anaerobic respiration, glycolysis, breakdown of glucose pathways, human respiratory system, alveoli gas exchange.
    - Transportation: Human circulatory system (double circulation, heart structure and chambers, blood vessels: arteries, veins, capillaries, blood pressure, lymphatic system), transportation in plants (xylem: ascent of sap/transpiration pull, phloem: translocation of sucrose).
    - Excretion: Human excretory system (kidney anatomy, nephron structure and urine formation: filtration, selective reabsorption, tubular secretion), artificial kidney (hemodialysis), plant excretion.
  - **Ch 6: Control and Coordination**: Nervous system in animals (neuron structure, synapse transmission, reflex arc), human brain (forebrain, midbrain, hindbrain: cerebrum, cerebellum, medulla, pons), coordination in plants (tropic movements: phototropism, geotropism, hydrotropism, chemotropism, nastic movements), plant hormones (auxin, gibberellin, cytokinin, abscisic acid), animal endocrine system (thyroid/thyroxine, pituitary/growth hormone, pancreas/insulin, adrenal/adrenaline, testes/testosterone, ovaries/estrogen).
  - **Ch 7: How do Organisms Reproduce?**: DNA copying significance and variation, asexual reproduction (fission, fragmentation, regeneration, budding, vegetative propagation, spore formation), sexual reproduction in flowering plants (flower anatomy: stamen, carpel, pollination: self and cross, double fertilisation, seed formation), sexual reproduction in humans (male and female reproductive systems, fertilization, menstruation cycle, placenta, reproductive health, contraception methods: barrier, chemical, surgical, STDs: HIV, gonorrhea, syphilis).
  - **Ch 8: Heredity**: Heredity and variation, Gregor Mendel's experiments on garden peas, monohybrid cross ($3:1$ phenotype, $1:2:1$ genotype), dihybrid cross ($9:3:3:1$), Law of Segregation, Law of Independent Assortment, sex determination in humans ($XX$ and $XY$).
  - **Ch 13: Our Environment**: Ecosystem components (biotic and abiotic), food chains and food webs, trophic levels and 10% law of energy transfer, biological magnification (biomagnification of pesticides), ozone layer depletion (CFCs), waste management (biodegradable vs non-biodegradable waste).
- **Physics**:
  - **Ch 9: Light - Reflection and Refraction**:
    - Reflection: Spherical mirrors (concave and convex), focus, pole, center of curvature, principal axis, ray diagrams for image formation, sign convention (New Cartesian), mirror formula:
      $$\frac{1}{f} = \frac{1}{v} + \frac{1}{u}, \quad m = -\frac{v}{u} = \frac{h'}{h}$$
    - Refraction: Laws of refraction, Snell's law ($n = \frac{\sin i}{\sin r}$), absolute refractive index ($n = c/v$), refraction through rectangular glass slab, spherical lenses (convex and concave), ray diagrams, lens formula:
      $$\frac{1}{f} = \frac{1}{v} - \frac{1}{u}, \quad m = +\frac{v}{u} = \frac{h'}{h}$$
      Power of a lens ($P = 1/f\text{ in meters}$, Dioptre D).
  - **Ch 10: The Human Eye and the Colorful World**: Anatomy of human eye (cornea, iris, pupil, crystalline lens, ciliary muscles, retina, optic nerve), power of accommodation, defects of vision and corrections: Myopia (concave lens), Hypermetropia (convex lens), Presbyopia (bifocal lens), refraction of light through a triangular glass prism, dispersion of white light (VIBGYOR), atmospheric refraction (twinkling of stars, advance sunrise and delayed sunset), scattering of light (Tyndall effect, blue color of the sky, reddening of the sun at sunrise/sunset).
  - **Ch 11: Electricity**: Electric current and circuit, electric potential and potential difference ($V = W/Q$), Ohm's Law ($V = IR$), resistance factors ($R = \rho \frac{l}{A}$), resistivity, series combination of resistors ($R_s = R_1 + R_2 + \dots$), parallel combination of resistors ($\frac{1}{R_p} = \frac{1}{R_1} + \frac{1}{R_2} + \dots$), Joule's Law of heating ($H = I^2Rt = VIt$), electric power ($P = VI = I^2R = V^2/R$), commercial unit ($1\text{ kWh} = 3.6 \times 10^6\text{ J}$).
  - **Ch 12: Magnetic Effects of Electric Current**: Magnetic field and field lines, Oersted's experiment, magnetic field due to straight conductor (Right-Hand Thumb Rule), circular loop, and solenoid, force on a current-carrying conductor in a magnetic field (Fleming's Left-Hand Rule), domestic electric circuits (live, neutral, earth wires, fuse, short circuit, overloading).

#### C. Class 10 Social Science (NCERT)
- **History: India and the Contemporary World - II**
  - Ch 1: The Rise of Nationalism in Europe (Frédéric Sorrieu's vision, French Revolution impact, Napoleonic Code 1804, Romanticism, unifications of Germany and Italy, Britain's case, nationalism and imperialism, Balkans crisis)
  - Ch 2: Nationalism in India (First World War, Rowlatt Act, Jallianwala Bagh 1919, Khilafat and Non-Cooperation Movement, differing strands: towns, countryside, tribal gudem hills, plantations; Simon Commission, Lahore Congress 1929, Salt March and Civil Disobedience Movement, Round Table Conferences, Poona Pact 1932, sense of collective belonging)
  - Ch 3: The Making of a Global World (Pre-modern world, Silk Routes, conquest, disease: smallpox, 19th-century trade, indenture labor migration, Great Depression 1929 causes and impact, post-war reconstruction: Bretton Woods institutions IMF and World Bank)
  - Ch 4: The Age of Industrialisation (Proto-industrialisation, factories come up, pace of industrial change, hand labor vs steam power in Victorian Britain, industrialisation in colonies: Indian weavers, colonial control, market for goods: advertisements and calendars)
  - Ch 5: Print Culture and the Modern World (First printed books: China, Japan, Korea; print comes to Europe: Gutenberg press; Protestant Reformation: Martin Luther; print revolution and public sphere; 19th-century reading mania; print culture in India: religious reform, women and print, censorship under Vernacular Press Act 1878)
- **Geography: Contemporary India - II**
  - Ch 1: Resources and Development (Classification, sustainable development, Rio Earth Summit 1992, Agenda 21, resource planning in India, land resources, land degradation and conservation measures, soil classification: Alluvial, Black, Red and Yellow, Laterite, Arid, Forest soils; soil erosion and terrace farming, strip cropping, shelter belts)
  - Ch 2: Forest and Wildlife Resources (Flora and fauna in India, IUCN classification: endangered, vulnerable, rare, endemic, extinct; factors of depletion, conservation: Project Tiger, community conservation: Chipko movement, Beej Bachao Andolan, Joint Forest Management - JFM)
  - Ch 3: Water Resources (Water scarcity, multi-purpose river projects and integrated water resources management: advantages and opposition, rainwater harvesting systems: rooftop rainwater harvesting, tankas, khadins, guls/kuls)
  - Ch 4: Agriculture (Types of farming, cropping patterns: Rabi, Kharif, Zaid; major crops: rice, wheat, sugarcane, oilseeds, tea, coffee, rubber, cotton, jute; institutional and technological reforms, Bhoodan-Gramdan movement, contribution to GDP and employment)
  - Ch 5: Minerals and Energy Resources (Mode of occurrence: veins, lodes, beds, layers, alluvial deposits, ocean waters; ferrous minerals: iron ore, manganese; non-ferrous: copper, bauxite; non-metallic: mica; rock minerals: limestone; conservation of minerals; conventional energy: coal, petroleum, natural gas, electricity; non-conventional: solar, wind, biogas, tidal, geo-thermal)
  - Ch 6: Manufacturing Industries (Importance of manufacturing, contribution to economy, industrial location, classification of industries; Agro-based: textile, sugar; Mineral-based: Iron and steel, aluminum smelting, chemical, fertilizer, cement, automobile, information technology and electronics; industrial pollution: air, water, thermal, noise; environmental degradation control: NTPC proactive approach)
  - Ch 7: Lifelines of National Economy (Transport: Roadways: Golden Quadrilateral, National Highways; Railways, Pipelines, Waterways: National Waterways NW-1, NW-2; Major Seaports: Kandla, Mumbai, Marmagao, New Mangalore, Kochi, Tuticorin, Chennai, Visakhapatnam, Paradip, Haldia; Airways; Communication: Postal network, Telecom; International Trade; Tourism as a trade)
- **Political Science: Democratic Politics - II**
  - Ch 1: Power Sharing (Case studies of Belgium: accommodation model; and Sri Lanka: majoritarianism; why power sharing is desirable: prudential vs moral reasons; forms of power sharing: horizontal, vertical, social groups, political parties and pressure groups)
  - Ch 2: Federalism (What is federalism?, key features, coming together vs holding together federations, what makes India a federal country?: Union, State, Concurrent Lists; linguistic states, language policy, Centre-State relations, decentralisation in India: 73rd and 74th Constitutional Amendments 1992, Panchayati Raj institutions)
  - Ch 3: Gender, Religion and Caste (Gender and politics: public/private division, feminist movements, women's political representation; Religion, communalism and politics: communal politics, secular state constitutional provisions; Caste and politics: caste inequalities, caste in politics, politics in caste)
  - Ch 4: Political Parties (Why do we need political parties?, functions, how many parties should we have?: one-party, two-party, multi-party systems; National parties: BJP, INC, AAP, BSP, CPI-M, etc.; State parties, challenges to political parties: lack of internal democracy, dynastic succession, money and muscle power, lack of meaningful choice; how can parties be reformed?)
  - Ch 5: Outcomes of Democracy (Assessing democratic outcomes: accountable, responsive and legitimate government; economic growth and development; reduction of inequality and poverty; accommodation of social diversity; dignity and freedom of the citizens)
- **Economics: Understanding Economic Development - II**
  - Ch 1: Development (What development promises: different people different goals; national development, comparing countries using per capita income: World Bank criteria; income and other criteria: Infant Mortality Rate, Literacy Rate, Net Attendance Ratio; Human Development Report by UNDP: HDI; sustainability of development: groundwater depletion, crude oil exhaustion)
  - Ch 2: Sectors of the Indian Economy (Primary, secondary, and tertiary sectors; comparing the three sectors through GDP; historical changes in sectors; rising importance of tertiary sector; employment sharing vs GDP contribution: disguised unemployment; creating more employment: MGNREGA 2005; organized vs unorganized sectors; public vs private sectors)
  - Ch 3: Money and Credit (Money as a medium of exchange, double coincidence of wants, modern forms of money: currency, bank deposits, cheques; loan activities of banks; two credit situations: festival season vs swapna's crop failure; terms of credit: interest rate, collateral, documentation, mode of repayment; formal sector credit in India: RBI supervision; informal sector: moneylenders, traders; Self-Help Groups - SHGs for the poor)
  - Ch 4: Globalisation and the Indian Economy (Production across countries: Multinational Corporations - MNCs; interlinking production across countries; foreign trade and integration of markets; what is globalisation?; factors enabling globalisation: technology in transport and ICT, trade liberalisation, WTO role; impact of globalisation in India: consumers, top Indian companies, small producers struggle; the struggle for a fair globalisation)
  - Ch 5: Consumer Rights (Consumer movement origin, Consumer Protection Act - COPRA 1986, consumer rights: safety, information, choice, representation, redressal, consumer education; three-tier quasi-judicial machinery: District, State, National commissions)

#### D. Class 10 Artificial Intelligence (CBSE Subject Code 417)
- **Part A: Employability Skills**: Communication, self-management, basic ICT, entrepreneurial, green skills.
- **Part B: Subject Specific Skills**:
  - **Unit 1: Introduction to AI**: Foundational AI concepts, smart cities, AI domains (Data, Computer Vision, NLP), AI vs ML vs DL.
  - **Unit 2: AI Project Cycle**: Deep dive into 5 stages: Problem Scoping, Data Acquisition, Data Exploration, Modeling (Rule-based, Decision Trees, Supervised vs Unsupervised vs Reinforcement), Evaluation.
  - **Unit 3: Computer Vision**: Image processing basics, pixels, RGB vs grayscale, applications (facial recognition, autonomous vehicles, object detection), Convolutional Neural Networks (CNN) conceptual overview.
  - **Unit 4: Natural Language Processing (NLP)**: Applications (chatbots, sentiment analysis, translation), Text Normalization (sentence segmentation, tokenization, removing stop words, stemming, lemmatization), Bag of Words (BoW) algorithm, Term Frequency-Inverse Document Frequency (TF-IDF).
  - **Unit 5: Evaluation**: Evaluating classification models: Confusion Matrix (TP, TN, FP, FN), Accuracy ($\frac{TP+TN}{TP+TN+FP+FN}$), Precision ($\frac{TP}{TP+FP}$), Recall ($\frac{TP}{TP+FN}$), F1-Score ($2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$), choosing appropriate metric based on False Positive vs False Negative cost.
  - **Unit 6: Advanced Python**: NumPy arrays, Pandas DataFrames for data manipulation, Matplotlib for data visualization, building basic ML classifiers with `scikit-learn`.

---

### 4.4. Class 11 Full Syllabus Breakdown

#### A. Class 11 Mathematics (NCERT)
- **Unit 1: Sets and Functions**
  - **Ch 1: Sets**: Representation of sets, empty set, finite and infinite sets, equal sets, subsets, power set, universal set, Venn diagrams, operations on sets (union, intersection, difference, complement).
  - **Ch 2: Relations and Functions**: Ordered pairs, Cartesian product of sets, relations, domain, codomain, range, functions as special relation, pictorial representation, polynomial, rational, modulus, signum, exponential, logarithmic, greatest integer functions with graphs.
  - **Ch 3: Trigonometric Functions**: Positive and negative angles, radian measure vs degree measure, trigonometric functions using unit circle, sign of trig functions, domain and range, identities: $\sin(x \pm y), \cos(x \pm y), \tan(x \pm y), \sin 2x, \cos 2x, \tan 2x, \sin 3x, \cos 3x$.
- **Unit 2: Algebra**
  - **Ch 4: Complex Numbers and Quadratic Equations**: Need for complex numbers, imaginary unit $i = \sqrt{-1}$, algebraic properties of complex numbers, modulus and conjugate, quadratic equations in complex number system.
  - **Ch 5: Linear Inequalities**: Linear inequalities in one variable, algebraic solutions and representation on the number line, graphical solution of linear inequalities in two variables.
  - **Ch 6: Permutations and Combinations**: Fundamental principle of counting, factorial $n!$, permutations $^nP_r = \frac{n!}{(n-r)!}$, combinations $^nC_r = \frac{n!}{r!(n-r)!}$, practical applications.
  - **Ch 7: Binomial Theorem**: History, statement and proof of Binomial Theorem for positive integral indices: $(a+b)^n = \sum_{k=0}^n \binom{n}{k} a^{n-k}b^k$, Pascal's triangle, general and middle terms.
  - **Ch 8: Sequences and Series**: Arithmetic and Geometric Progression, general term, sum of $n$ terms of GP, infinite GP sum $S_\infty = \frac{a}{1-r}$, geometric mean (GM), relationship between AM and GM.
- **Unit 3: Coordinate Geometry**
  - **Ch 9: Straight Lines**: Slope of a line $m = \tan \theta$, angle between two lines, various forms of equations of a line (point-slope, slope-intercept, two-point, intercept form, normal form), distance of a point from a line.
  - **Ch 10: Conic Sections**: Sections of a cone, circle ($x^2+y^2=r^2$), parabola ($y^2=4ax$), ellipse ($\frac{x^2}{a^2}+\frac{y^2}{b^2}=1$), hyperbola ($\frac{x^2}{a^2}-\frac{y^2}{b^2}=1$), standard equations, eccentricity, foci, vertices, directrix, latus rectum.
  - **Ch 11: Introduction to Three-Dimensional Geometry**: Coordinate axes and planes in 3D, coordinates of a point, distance between two points in 3D, section formula.
- **Unit 4: Calculus**
  - **Ch 12: Limits and Derivatives**: Intuitive idea of limits, limits of polynomials and rational functions, trigonometric limits ($\lim_{x \to 0}\frac{\sin x}{x}=1$), derivative as rate of change, geometric meaning, first principles derivative, derivative of polynomials and trigonometric functions, product and quotient rules.
- **Unit 5: Statistics and Probability**
  - **Ch 13: Statistics**: Measures of dispersion: range, mean deviation about mean and median, variance and standard deviation of ungrouped and grouped data, coefficient of variation.
  - **Ch 14: Probability**: Random experiments, outcomes, sample spaces, events (mutually exclusive, exhaustive), axiomatic probability, probability of event "not A", "A or B", "A and B".

#### B. Class 11 Physics (NCERT)
- **Unit 1: Physical World and Measurement**
  - **Ch 1: Units and Measurements**: SI units, fundamental and derived units, significant figures, dimensional analysis and applications (checking equation correctness, deriving relations, converting units).
- **Unit 2: Kinematics**
  - **Ch 2: Motion in a Straight Line**: Frame of reference, position-time graph, instantaneous velocity and acceleration, kinematic calculus relations ($v = dx/dt, a = dv/dt$), relative velocity.
  - **Ch 3: Motion in a Plane**: Scalars and vectors, vector addition (triangle and parallelogram laws), unit vectors, resolution of vectors, scalar (dot) and vector (cross) products, projectile motion (time of flight $T = \frac{2u\sin\theta}{g}$, maximum height $H = \frac{u^2\sin^2\theta}{2g}$, horizontal range $R = \frac{u^2\sin 2\theta}{g}$), uniform circular motion and centripetal acceleration ($a_c = v^2/r = \omega^2 r$).
- **Unit 3: Laws of Motion**
  - **Ch 4: Laws of Motion**: Newton's laws of motion, momentum, impulse, conservation of momentum, equilibrium of concurrent forces, friction (static, kinetic, laws of friction, angle of friction, banking of roads $v = \sqrt{rg\tan\theta}$).
- **Unit 4: Work, Energy and Power**
  - **Ch 5: Work, Energy and Power**: Work-energy theorem, conservative vs non-conservative forces, potential energy of a spring ($U = \frac{1}{2}kx^2$), conservation of mechanical energy, elastic and inelastic collisions in 1D and 2D.
- **Unit 5: Motion of System of Particles and Rigid Body**
  - **Ch 6: System of Particles and Rotational Motion**: Center of mass of two-particle and $N$-particle systems, momentum conservation of CM, torque $\vec{\tau} = \vec{r} \times \vec{F}$, angular momentum $\vec{L} = \vec{r} \times \vec{p}$, conservation of angular momentum, moment of inertia ($I = \sum m_i r_i^2$), radius of gyration, rotational kinetic energy ($K_{\text{rot}} = \frac{1}{2}I\omega^2$).
- **Unit 6: Gravitation**
  - **Ch 7: Gravitation**: Kepler's laws of planetary motion, universal gravitation, variation of $g$ with altitude ($g' = g(1 - 2h/R)$) and depth ($g' = g(1 - d/R)$), gravitational potential energy ($U = -G\frac{Mm}{r}$), escape velocity ($v_e = \sqrt{2gR}$), orbital velocity of satellites ($v_o = \sqrt{gR}$), geostationary satellites.
- **Unit 7: Properties of Bulk Matter**
  - **Ch 8: Mechanical Properties of Solids**: Stress-strain curve, Hooke's Law, Young's modulus, bulk modulus, shear modulus, Poisson's ratio, elastic potential energy.
  - **Ch 9: Mechanical Properties of Fluids**: Pressure, Pascal's Law and hydraulic lift, streamline and turbulent flow, equation of continuity ($A_1v_1 = A_2v_2$), Bernoulli's theorem ($P + \frac{1}{2}\rho v^2 + \rho gh = \text{constant}$), viscosity, Stokes' Law ($F = 6\pi \eta r v$), terminal velocity, surface tension, angle of contact, capillary rise.
  - **Ch 10: Thermal Properties of Matter**: Temperature and heat, thermal expansion, specific heat capacity ($C = \Delta Q / m\Delta T$), calorimetry, change of state, latent heat, heat transfer (conduction, convection, radiation), Newton's Law of Cooling, Stefan-Boltzmann law, Wien's displacement law.
- **Unit 8: Thermodynamics**
  - **Ch 11: Thermodynamics**: Thermal equilibrium, Zeroth Law of Thermodynamics, First Law of Thermodynamics ($\Delta Q = \Delta U + \Delta W$), isothermal and adiabatic processes, Second Law of Thermodynamics (Kelvin-Planck and Clausius statements), reversible and irreversible processes.
- **Unit 9: Kinetic Theory of Gases**
  - **Ch 12: Kinetic Theory**: Equation of state of ideal gas ($PV = nRT$), kinetic theory postulates, pressure of gas ($P = \frac{1}{3}\rho v_{\text{rms}}^2$), kinetic interpretation of temperature, degrees of freedom, equipartition of energy, specific heats of mono/di/polyatomic gases, mean free path.
- **Unit 10: Oscillations and Waves**
  - **Ch 13: Oscillations**: Periodic and oscillatory motion, Simple Harmonic Motion (SHM) equation ($x = A\sin(\omega t + \phi)$), velocity and acceleration in SHM, energy in SHM, simple pendulum time period ($T = 2\pi\sqrt{l/g}$), spring mass system.
  - **Ch 14: Waves**: Wave motion, transverse and longitudinal waves, displacement relation for a progressive wave, speed of traveling wave, principle of superposition, reflection of waves, standing waves in strings and organ pipes, fundamental mode and harmonics, beats phenomenon ($\Delta f = f_1 - f_2$).

#### C. Class 11 Chemistry (NCERT)
- **Ch 1: Some Basic Concepts of Chemistry**: Matter classification, Dalton's atomic theory, atomic and molecular masses, mole concept and molar mass, percentage composition, empirical and molecular formulas, stoichiometry and stoichiometric calculations, limiting reagent, concentration terms (molarity, molality, mole fraction).
- **Ch 2: Structure of Atom**: Discovery of subatomic particles, Thomson, Rutherford models, Bohr model and hydrogen emission spectrum, de Broglie relation ($\lambda = h/p$), Heisenberg's uncertainty principle ($\Delta x \cdot \Delta p \geq h/4\pi$), quantum mechanical model, quantum numbers ($n, l, m_l, m_s$), shapes of $s, p, d$ orbitals, Aufbau principle, Pauli exclusion principle, Hund's rule of maximum multiplicity.
- **Ch 3: Classification of Elements and Periodicity in Properties**: Modern periodic law and periodic table, periodic trends in physical and chemical properties: atomic radii, ionic radii, ionization enthalpy, electron gain enthalpy, electronegativity (Pauling scale), anomalous properties of second-period elements.
- **Ch 4: Chemical Bonding and Molecular Structure**: Valence electrons, ionic bond, covalent bond, Lewis structures, octet rule limitations, VSEPR theory (shapes of simple molecules), valence bond theory, hybridization ($sp, sp^2, sp^3, dsp^2, sp^3d, sp^3d^2$) with examples ($\text{CH}_4, \text{C}_2\text{H}_4, \text{C}_2\text{H}_2, \text{PCl}_5, \text{SF}_6$), Molecular Orbital Theory (LCAO, homonuclear diatomic molecules: $\text{H}_2, \text{N}_2, \text{O}_2$), bond order, hydrogen bonding (inter vs intramolecular).
- **Ch 5: Chemical Thermodynamics**: First Law of Thermodynamics, internal energy, enthalpy ($\Delta H = \Delta U + P\Delta V$), heat capacity, Hess's Law of Constant Heat Summation, standard enthalpies of formation, combustion, atomization, bond dissociation; spontaneity, entropy ($\Delta S$), Gibbs free energy change ($\Delta G = \Delta H - T\Delta S$) and spontaneity criteria ($\Delta G < 0$).
- **Ch 6: Equilibrium**: Equilibrium in physical and chemical processes, dynamic nature, Law of Chemical Equilibrium and equilibrium constant ($K_c, K_p$), relationship $K_p = K_c(RT)^{\Delta n}$, Le Chatelier's principle (effect of concentration, temperature, pressure, catalyst), ionic equilibrium: acids and bases (Arrhenius, Bronsted-Lowry, Lewis), ionization of weak acids/bases, pH scale, ionization of water ($K_w$), buffer solutions, common ion effect, solubility product ($K_{\text{sp}}$).
- **Ch 7: Redox Reactions**: Oxidation and reduction concepts, oxidation numbers, balancing redox reactions: ion-electron method and oxidation number method, electrochemical cells (Daniell cell basics).
- **Ch 8: Organic Chemistry: Some Basic Principles and Techniques**: Tetravalence of carbon, IUPAC nomenclature of organic compounds, structural and stereoisomerism, inductive effect, electromeric effect, resonance, hyperconjugation, homolytic and heterolytic fission, carbocations, carbanions, free radicals, electrophiles and nucleophiles, purification techniques (distillation, crystallization, chromatography), qualitative and quantitative analysis (Dumas, Kjeldahl methods).
- **Ch 9: Hydrocarbons**:
  - Alkanes: Preparation, physical properties, chemical reactions: free radical halogenation, combustion, pyrolysis.
  - Alkenes: Structure, geometrical isomerism (cis-trans), preparation from alkyl halides and alcohols, chemical reactions: addition of hydrogen, halogens, water, hydrogen halides (Markovnikov's rule, anti-Markovnikov peroxide effect), ozonolysis.
  - Alkynes: Structure, acidity of terminal alkynes, addition reactions.
  - Aromatic Hydrocarbons: Benzene structure, resonance, aromaticity (Hückel's $(4n+2)\pi$ rule), electrophilic aromatic substitution mechanism (nitration, sulphonation, halogenation, Friedel-Crafts alkylation and acylation).

#### D. Class 11 Biology (NCERT)
- **Unit 1: Diversity in the Living World**: Ch 1: The Living World (characteristics, taxonomy, binomial nomenclature), Ch 2: Biological Classification (5 kingdoms of Whittaker: Monera, Protista, Fungi, Plantae, Animalia, viruses, viroids, prions), Ch 3: Plant Kingdom (Algae, Bryophytes, Pteridophytes, Gymnosperms, Angiosperms, plant life cycles), Ch 4: Animal Kingdom (Classification criteria: symmetry, coelom, non-chordates to chordates).
- **Unit 2: Structural Organisation in Animals and Plants**: Ch 5: Morphology of Flowering Plants (Root, stem, leaf modifications, inflorescence, flower, fruit, seed, family descriptions: Solanaceae, Fabaceae), Ch 6: Anatomy of Flowering Plants (Meristematic and permanent tissues, primary and secondary growth in dicot/monocot stem and root), Ch 7: Structural Organisation in Animals (Animal tissues, anatomy and organ systems of Frog).
- **Unit 3: Cell: Structure and Function**: Ch 8: Cell: The Unit of Life (Prokaryotic and eukaryotic cells, endomembrane system, organelles, nucleus, cytoskeleton), Ch 9: Biomolecules (Carbohydrates, amino acids, proteins: primary/secondary/tertiary structures, lipids, nucleic acids: DNA, RNA, enzymes: mechanism, kinetics, activation energy, competitive inhibition), Ch 10: Cell Cycle and Cell Division (Interphase: G1, S, G2; Mitosis stages, Meiosis I and II, crossing over and chiasmata).
- **Unit 4: Plant Physiology**: Ch 13: Photosynthesis in Higher Plants (Chloroplast pigments, light reaction: photolysis, cyclic and non-cyclic photophosphorylation, Calvin cycle C3, Hatch-Slack pathway C4, photorespiration, Blackman's law of limiting factors), Ch 14: Respiration in Plants (Glycolysis, fermentation, Krebs/TCA cycle, electron transport system ETS and oxidative phosphorylation, respiratory quotient RQ), Ch 15: Plant Growth and Development (Phytohormones: Auxins, Gibberellins, Cytokinins, Ethylene, ABA, photoperiodism, vernalization).
- **Unit 5: Human Physiology**: Ch 17: Breathing and Exchange of Gases (Respiratory organs, pulmonary volumes, gas exchange, transport of $\text{O}_2$ and $\text{CO}_2$, regulation), Ch 18: Body Fluids and Circulation (Blood components, ABO/Rh grouping, cardiac cycle, ECG, double circulation, regulation), Ch 19: Excretory Products and Their Elimination (Nephron structure, urine formation, countercurrent mechanism, RAAS regulation, micturition), Ch 20: Locomotion and Movement (Skeletal system, joints, sliding filament theory of muscle contraction), Ch 21: Neural Control and Coordination (Neuron, impulse generation and transmission, CNS, reflex action, sensory reception).

#### E. Class 11 Artificial Intelligence (CBSE Subject Code 843)
- **Part A: Employability Skills**: Communication, self-management, ICT, entrepreneurship, green skills.
- **Part B: Subject Specific Skills**:
  - **Unit 1: Introduction to AI and Python Refresher**: Python data structures, list comprehensions, lambda functions, OOP in Python (classes, objects, inheritance), NumPy multidimensional array manipulation, Pandas series and DataFrames.
  - **Unit 2: Data Science Methodology**: Problem statement formulation, data collection (APIs, scraping, databases), exploratory data analysis (EDA), handling missing values, feature scaling (Standardization vs MinMax), encoding categorical variables (One-Hot, Label Encoding).
  - **Unit 3: Applied Machine Learning Algorithms**:
    - Supervised Learning: Linear Regression (cost function, gradient descent), Logistic Regression (sigmoid, log loss), Decision Trees (entropy, information gain, Gini impurity), K-Nearest Neighbors (KNN, distance metrics).
    - Unsupervised Learning: K-Means Clustering (Elbow method), Principal Component Analysis (PCA basics).
  - **Unit 4: Mathematics for Machine Learning**: Linear algebra (matrix operations, eigenvectors), probability distributions (normal, binomial), calculus (partial derivatives in gradient descent), loss functions (MSE, Cross-entropy).
  - **Unit 5: Computer Vision Foundation**: OpenCV image operations, edge detection (Sobel, Canny), Haar cascades for face detection, thresholding and morphological operations.
  - **Unit 6: AI Ethics & Society**: Responsible AI frameworks, data bias mitigation, AI governance, European Union / Indian guidelines for trustworthy AI.

---

### 4.5. Class 12 Full Syllabus Breakdown

#### A. Class 12 Mathematics (NCERT)
- **Unit 1: Relations and Functions**
  - **Ch 1: Relations and Functions**: Types of relations: reflexive, symmetric, transitive, equivalence relations; types of functions: one-one (injective), onto (surjective), bijective; composite functions, invertible functions.
  - **Ch 2: Inverse Trigonometric Functions**: Definition, range, domain, principal value branch of $\sin^{-1}, \cos^{-1}, \tan^{-1}, \cot^{-1}, \sec^{-1}, \csc^{-1}$, graphs and basic properties.
- **Unit 2: Algebra**
  - **Ch 3: Matrices**: Concept, notation, order, equality, types of matrices (zero, identity, diagonal), operations (addition, scalar multiplication, matrix multiplication), non-commutativity of multiplication, transpose of a matrix, symmetric and skew-symmetric matrices, elementary row operations.
  - **Ch 4: Determinants**: Determinant of a square matrix (up to $3 \times 3$), minors, cofactors, adjoint and inverse of a matrix, consistency/inconsistency and solving system of linear equations using matrix method ($X = A^{-1}B$).
- **Unit 3: Calculus**
  - **Ch 5: Continuity and Differentiability**: Continuity of a function at a point and in an interval, differentiability, chain rule, derivative of inverse trigonometric functions, implicit functions, logarithmic differentiation ($y = u(x)^{v(x)}$), parametric differentiation, second-order derivatives ($d^2y/dx^2$).
  - **Ch 6: Applications of Derivatives**: Rate of change of quantities, increasing and decreasing functions (using $f'(x) \geq 0$ / $f'(x) \leq 0$), tangents and normals, maxima and minima (first derivative test, second derivative test), word problems on optimization.
  - **Ch 7: Integrals**: Integration as inverse process of differentiation, standard integrals, integration by substitution, integration by partial fractions, integration by parts ($\int u v \, dx = u \int v \, dx - \int [u' \int v \, dx] \, dx$), definite integrals as limit of a sum, Fundamental Theorem of Calculus, properties of definite integrals:
    $$\int_0^a f(x)\,dx = \int_0^a f(a-x)\,dx, \quad \int_{-a}^a f(x)\,dx = 2\int_0^a f(x)\,dx \text{ (if even)}$$
  - **Ch 8: Applications of the Integrals**: Area under simple curves (lines, circles, parabolas, ellipses in standard form), area between two curves.
  - **Ch 9: Differential Equations**: Definition, order and degree of a differential equation, general and particular solutions, formation of differential equations, solving separable variable differential equations, homogeneous differential equations of first order, linear differential equations of the type:
    $$\frac{dy}{dx} + Py = Q, \quad \text{IF} = e^{\int P\,dx}$$
- **Unit 4: Vectors and Three-Dimensional Geometry**
  - **Ch 10: Vector Algebra**: Vectors and scalars, magnitude and direction, direction cosines and ratios, types of vectors, position vector, addition of vectors, multiplication by scalar, scalar (dot) product ($\vec{a}\cdot\vec{b} = |\vec{a}||\vec{b}|\cos\theta$), vector (cross) product ($\vec{a}\times\vec{b} = |\vec{a}||\vec{b}|\sin\theta\,\hat{n}$).
  - **Ch 11: Three-Dimensional Geometry**: Direction cosines and direction ratios of a line joining two points, Cartesian and vector equations of a line in space, coplanar and skew lines, shortest distance between two skew lines:
    $$d = \left| \frac{(\vec{b}_1 \times \vec{b}_2) \cdot (\vec{a}_2 - \vec{a}_1)}{|\vec{b}_1 \times \vec{b}_2|} \right|$$
    Angle between two lines.
- **Unit 5: Linear Programming**
  - **Ch 12: Linear Programming**: Introduction, related terminology: constraints, objective function, optimization, mathematical formulation of LPP, graphical method of solving LPP in two variables, feasible and infeasible regions, optimal feasible solutions (corner point method).
- **Unit 6: Probability**
  - **Ch 13: Probability**: Conditional probability $P(A|B) = \frac{P(A \cap B)}{P(B)}$, multiplication theorem on probability, independent events, Theorem of Total Probability, Bayes' Theorem:
    $$P(E_i|A) = \frac{P(E_i)P(A|E_i)}{\sum P(E_j)P(A|E_j)}$$
    Random variable and its probability distribution, mean and variance of random variable.

#### B. Class 12 Physics (NCERT)
- **Unit 1: Electrostatics**
  - **Ch 1: Electric Charges and Fields**: Electric charges, conservation and quantization ($q = ne$), Coulomb's Law in vector form, superposition principle, electric field due to point charge, electric field lines, electric dipole and dipole moment ($\vec{p} = q \cdot 2\vec{a}$), torque on a dipole in uniform field ($\vec{\tau} = \vec{p} \times \vec{E}$), electric flux ($\Phi = \oint \vec{E}\cdot d\vec{A}$), Gauss's Law and applications (infinitely long straight wire, uniformly charged infinite plane sheet, thin spherical shell).
  - **Ch 2: Electrostatic Potential and Capacitance**: Electric potential due to point charge and dipole, equipotential surfaces, potential energy of system of charges, conductors and insulators, dielectrics and electric polarization, capacitors and capacitance, parallel plate capacitor with and without dielectric medium ($C = \frac{\kappa \epsilon_0 A}{d}$), series and parallel combinations, energy stored in a capacitor ($U = \frac{1}{2}CV^2$).
- **Unit 2: Current Electricity**
  - **Ch 3: Current Electricity**: Electric current, drift velocity of electrons ($v_d = \frac{eE\tau}{m}$) and mobility, relation between current and drift velocity ($I = n e A v_d$), Ohm's Law, electrical resistance, $V-I$ characteristics (ohmic and non-ohmic), temperature dependence of resistance, internal resistance of a cell, EMF and terminal voltage ($V = E - Ir$), combinations of cells in series and parallel, Kirchhoff's Laws (Junction rule $\sum I = 0$, Loop rule $\sum \Delta V = 0$), Wheatstone bridge balance condition ($P/Q = R/S$).
- **Unit 3: Magnetic Effects of Current and Magnetism**
  - **Ch 4: Moving Charges and Magnetism**: Concept of magnetic field, Oersted's experiment, Biot-Savart Law and application to current-carrying circular loop, Ampere's Circuital Law and application to infinitely long straight wire and solenoid, force on moving charge in magnetic field (Lorentz force $\vec{F} = q(\vec{v}\times\vec{B})$), cyclotron frequency, force on current-carrying conductor ($\vec{F} = I(\vec{L}\times\vec{B})$), force between two parallel current-carrying conductors (definition of Ampere), torque on current loop in magnetic field ($\vec{\tau} = \vec{M}\times\vec{B}$), moving coil galvanometer, conversion to ammeter and voltmeter.
  - **Ch 5: Magnetism and Matter**: Current loop as magnetic dipole, bar magnet as equivalent solenoid, magnetic field lines, Earth's magnetic field components (declination, dip, horizontal component), magnetic properties of materials: diamagnetic, paramagnetic, ferromagnetic substances, Curie's Law, permanent magnets and electromagnets.
- **Unit 4: Electromagnetic Induction and Alternating Currents**
  - **Ch 6: Electromagnetic Induction**: Faraday's experiments, magnetic flux, Faraday's Law of induction ($\mathcal{E} = -d\Phi/dt$), Lenz's Law and conservation of energy, motional EMF ($\mathcal{E} = Bvl$), eddy currents, self-inductance ($L$) and mutual inductance ($M$), energy stored in an inductor ($U = \frac{1}{2}LI^2$).
  - **Ch 7: Alternating Current**: Peak and RMS values of AC current and voltage ($I_{\text{rms}} = I_0/\sqrt{2}$), reactance ($X_L = \omega L, X_C = 1/\omega C$), impedance ($Z$) of series LCR circuit, phasor diagrams, resonance condition ($\omega_0 = 1/\sqrt{LC}$), quality factor $Q$, power in AC circuits, power factor ($\cos\phi$), wattless current, AC generator, step-up and step-down transformers.
- **Unit 5: Electromagnetic Waves**
  - **Ch 8: Electromagnetic Waves**: Displacement current (Ampere-Maxwell law), characteristics of EM waves, transverse nature, relation $c = 1/\sqrt{\mu_0\epsilon_0} = E_0/B_0$, electromagnetic spectrum (radio, micro, infrared, visible, ultraviolet, X-rays, gamma rays) with wavelengths and applications.
- **Unit 6: Optics**
  - **Ch 9: Ray Optics and Optical Instruments**: Refraction at spherical surfaces, lens maker's formula:
    $$\frac{1}{f} = (\mu - 1)\left(\frac{1}{R_1} - \frac{1}{R_2}\right)$$
    Refraction and dispersion through prism, total internal reflection (TIR) and optical fibers, optical instruments: compound microscope and astronomical telescope (magnifying power in normal adjustment and near point).
  - **Ch 10: Wave Optics**: Wavefront and Huygens' principle, reflection and refraction proof using wave theory, coherent sources, interference of light: Young's double slit experiment (YDSE), fringe width expression ($\beta = \frac{\lambda D}{d}$), diffraction of light at a single slit, central maximum width.
- **Unit 7: Dual Nature of Radiation and Matter**
  - **Ch 11: Dual Nature of Radiation and Matter**: Photoelectric effect, Hertz and Lenard observations, Einstein's photoelectric equation ($h\nu = \phi_0 + K_{\max}$), work function, threshold frequency, stopping potential, particle nature of light (photon), de Broglie hypothesis ($\lambda = h/p = \frac{h}{\sqrt{2mqV}}$).
- **Unit 8: Atoms and Nuclei**
  - **Ch 12: Atoms**: Alpha particle scattering experiment, Rutherford's nuclear model, Bohr model of hydrogen atom, postulates, radius of $n$-th orbit ($r_n \propto n^2$), energy levels ($E_n = -13.6/n^2\text{ eV}$), hydrogen spectrum series (Lyman, Balmer, Paschen, Brackett, Pfund), de Broglie's explanation of Bohr's second postulate.
  - **Ch 13: Nuclei**: Composition and size of nucleus ($R = R_0 A^{1/3}$), mass defect, binding energy and binding energy per nucleon curve, nuclear fission (uranium chain reaction), nuclear fusion (stellar energy in the Sun).
- **Unit 9: Electronic Devices**
  - **Ch 14: Semiconductor Electronics: Materials, Devices and Simple Circuits**: Energy bands in conductors, semiconductors, insulators; intrinsic and extrinsic semiconductors ($n$-type and $p$-type), $p-n$ junction diode formation (depletion layer, barrier potential), forward and reverse bias characteristics, $p-n$ diode as half-wave and full-wave rectifier.

#### C. Class 12 Chemistry (NCERT)
- **Ch 1: Solutions**: Types of solutions, expression of concentration, Henry's Law, Raoult's Law for volatile and non-volatile solutes, ideal and non-ideal solutions (positive and negative deviations from Raoult's Law), azeotropes, colligative properties: relative lowering of vapour pressure, elevation of boiling point ($\Delta T_b = K_b \cdot m$), depression of freezing point ($\Delta T_f = K_f \cdot m$), osmotic pressure ($\Pi = CRT$), van 't Hoff factor ($i$) and abnormal molar masses.
- **Ch 2: Electrochemistry**: Redox reactions review, galvanic cells, Nernst equation:
  $$E_{\text{cell}} = E^\circ_{\text{cell}} - \frac{0.0591}{n}\log Q$$
  Equilibrium constant from Nernst equation, standard Gibbs free energy ($\Delta G^\circ = -nFE^\circ_{\text{cell}}$), electrical conductivity, molar conductivity ($\Lambda_m$), variation of conductivity with concentration, Kohlrausch's Law of Independent Migration of Ions, electrolysis laws (Faraday's 1st and 2nd laws), commercial batteries (lead storage, dry cell), fuel cells ($\text{H}_2-\text{O}_2$), corrosion mechanism.
- **Ch 3: Chemical Kinetics**: Rate of reaction (average and instantaneous), factors affecting rate, rate law and specific rate constant ($k$), order and molecularity of a reaction, integrated rate equations for zero and first order reactions, half-life period ($t_{1/2}$), collision theory basics, Arrhenius equation ($k = A e^{-E_a/RT}$), activation energy determination.
- **Ch 4: The d- and f-Block Elements**: Transition elements position and electronic configurations, general trends in properties: metallic character, atomic/ionic sizes, oxidation states, ionization enthalpies, colored ions, catalytic properties, magnetic properties (spin-only magnetic moment $\mu = \sqrt{n(n+2)}\text{ BM}$), interstitial compounds, alloy formation, preparation and properties of $\text{K}_2\text{Cr}_2\text{O}_7$ and $\text{KMnO}_4$; Lanthanoids: electronic configuration, oxidation states, lanthanoid contraction; Actinoids overview.
- **Ch 5: Coordination Compounds**: Coordination compounds terminology: ligands (unidentate, bidentate, ambidentate, chelating), coordination number, coordination sphere, IUPAC nomenclature of mononuclear coordination compounds, isomerism (structural: ionization, hydrate, linkage, coordination; stereoisomerism: geometrical cis/trans and optical), Werner's coordination theory, Valence Bond Theory (VBT: inner vs outer orbital complexes, hybridization $sp^3, dsp^2, sp^3d^2, d^2sp^3$), Crystal Field Theory (CFT: crystal field splitting in octahedral and tetrahedral complexes, spectrochemical series, high spin vs low spin), bonding in metal carbonyls, applications in medicine and analytical chemistry.
- **Ch 6: Haloalkanes and Haloarenes**: Classification and nomenclature, nature of $\text{C}-\text{X}$ bond, preparation methods from alcohols, hydrocarbons, and halogen exchange; physical properties, nucleophilic substitution reactions: mechanisms of $S_N1$ (two-step, carbocation, racemization) and $S_N2$ (one-step, backside attack, Walden inversion); elimination reactions (Saytzeff's rule), reaction with metals (Grignard reagent); Haloarenes: low reactivity towards nucleophilic substitution, electrophilic aromatic substitution, polyhalogen compounds ($\text{CHCl}_3, \text{CHI}_3$, freons, DDT).
- **Ch 7: Alcohols, Phenols and Ethers**:
  - Alcohols: Classification, preparation from alkenes (hydration, hydroboration-oxidation), carbonyl compounds (reduction of aldehydes/ketones, Grignard synthesis); physical properties, reactions: acidity, esterification, dehydration to alkenes, oxidation (PCC, acidified $\text{KMnO}_4$), Lucas test for $1^\circ, 2^\circ, 3^\circ$ alcohols.
  - Phenols: Preparation from cumene, benzene sulphonic acid, diazonium salts; acidity comparison with alcohols, Kolbe's reaction, Reimer-Tiemann reaction, reaction with zinc dust, oxidation to benzoquinone.
  - Ethers: Nomenclature, Williamson's synthesis, cleavage of $\text{C}-\text{O}$ bond by $\text{HX}$ (mechanism).
- **Ch 8: Aldehydes, Ketones and Carboxylic Acids**:
  - Aldehydes and Ketones: Nomenclature and carbonyl structure, preparation methods: Rosenmund reduction, Stephen reaction, Etard reaction, Gattermann-Koch, Friedel-Crafts acylation, ozonolysis; nucleophilic addition reactions (addition of $\text{HCN}, \text{NaHSO}_3$, alcohols, Grignard, ammonia derivatives); reduction (Clemmensen, Wolff-Kishner); oxidation (Tollens' test, Fehling's test, haloform reaction); reactions due to $\alpha$-hydrogen: Aldol condensation, cross-Aldol; Cannizzaro reaction; electrophilic substitution.
  - Carboxylic Acids: Acidity and effect of substituents on acid strength, preparation, reactions: formation of acid chlorides, esters, amides; decarboxylation, Hell-Volhard-Zelinsky (HVZ) reaction.
- **Ch 9: Amines**: Structure, classification, IUPAC nomenclature, preparation from nitro compounds, nitriles, amides, Gabriel phthalimide synthesis, Hofmann bromamide degradation; physical properties, basic character of amines in aqueous and gaseous phase ($2^\circ > 1^\circ > 3^\circ > \text{NH}_3$ vs $2^\circ > 3^\circ > 1^\circ$), chemical reactions: carbylamine test, reaction with nitrous acid ($\text{HNO}_2$), Hinsberg's reagent test; Diazonium salts: preparation, Sandmeyer reaction, Gattermann reaction, coupling reactions with phenol and aniline.
- **Ch 10: Biomolecules**:
  - Carbohydrates: Classification, monosaccharides: D-glucose (structure, Fischer projection, cyclic structure, mutarotation), D-fructose, disaccharides: sucrose (glycosidic linkage, reducing vs non-reducing), maltose, lactose; polysaccharides: starch (amylose + amylopectin), cellulose, glycogen.
  - Proteins: Amino acids (essential vs non-essential, zwitterion, isoelectric point), peptide bond, proteins classification (fibrous vs globular), primary, secondary ($\alpha$-helix, $\beta$-pleated sheet), tertiary, quaternary structures; denaturation of proteins.
  - Nucleic Acids: Chemical composition, nucleosides, nucleotides, phosphodiester linkage, DNA double helix model (Watson-Crick, base pairing A-T, G-C), RNA types (mRNA, tRNA, rRNA), genetic code basics.
  - Vitamins: Classification (fat-soluble vs water-soluble), deficiency diseases.

#### D. Class 12 Biology (NCERT)
- **Unit 6: Reproduction**: Ch 1: Sexual Reproduction in Flowering Plants (Microsporogenesis, megasporogenesis, female gametophyte embryo sac structure, pollination, outbreeding devices, pollen-pistil interaction, double fertilization, endosperm and embryo development, apomixis and polyembryony), Ch 2: Human Reproduction (Male and female reproductive systems, microscopic anatomy of testis and ovary, spermatogenesis, oogenesis, menstrual cycle, fertilization, blastocyst development, implantation, pregnancy, placenta, parturition, lactation), Ch 3: Reproductive Health (Need for reproductive health, population explosion, contraception methods: natural, barrier, IUDs, pills, surgical; medical termination of pregnancy MTP, STIs, infertility and assisted reproductive technologies ART: IVF, ZIFT, GIFT, ICSI).
- **Unit 7: Genetics and Evolution**: Ch 4: Principles of Inheritance and Variation (Mendelian experiments, incomplete dominance, co-dominance, multiple alleles: ABO blood groups, chromosomal theory of inheritance, linkage and recombination: Morgan's Drosophila crosses, sex determination in humans, birds, honeybees; sex-linked inheritance: color blindness, hemophilia; Mendelian disorders: thalassemia, sickle cell anemia, PKU; chromosomal disorders: Down's, Turner's, Klinefelter's syndromes), Ch 5: Molecular Basis of Inheritance (DNA as genetic material: Griffith, Avery-MacLeod-McCarty, Hershey-Chase; structure of DNA and RNA, DNA packaging: nucleosome; DNA replication: Meselson-Stahl experiment, replication fork enzymes; transcription unit, genetic code: characteristics; translation mechanism, regulation of gene expression: Lac Operon model; Human Genome Project HGP, DNA fingerprinting), Ch 6: Evolution (Origin of life: Oparin-Haldane, Miller-Urey experiment; evidence for evolution: homologous vs analogous organs, adaptive radiation: Darwin's finches; theories of evolution: Lamarck, Darwin, Mutation theory of de Vries; Hardy-Weinberg principle equation $p^2 + 2pq + q^2 = 1$; human evolution stages).
- **Unit 8: Biology in Human Welfare**: Ch 7: Human Health and Disease (Pathogens causing human diseases: Typhoid, Pneumonia, Common cold, Malaria life cycle, Amoebiasis, Ringworm; immunity: innate vs acquired, active vs passive, vaccination, allergies, autoimmunity; lymphoid organs; AIDS mechanism and transmission; Cancer causes and detection; drugs and alcohol abuse), Ch 8: Microbes in Human Welfare (Household products: curd, cheese, bread; industrial products: fermented beverages, antibiotics, enzymes, bioactive molecules like cyclosporin A, statins; sewage treatment: primary and secondary biological treatment, BOD; biogas production; biocontrol agents: Bacillus thuringiensis, Trichoderma; biofertilizers: Rhizobium, Mycorrhiza, Cyanobacteria).
- **Unit 9: Biotechnology**: Ch 9: Biotechnology: Principles and Processes (Recombinant DNA technology tools: restriction enzymes: exonucleases, endonucleases, recognition sequences; cloning vectors: plasmids, pBR322 selectable markers, insertional inactivation, competent hosts; processes of rDNA technology: isolation, PCR amplification, insertion into host, bioreactors, downstream processing), Ch 10: Biotechnology and Its Applications (Applications in agriculture: Bt cotton, RNA interference RNAi for pest resistance; applications in medicine: genetically engineered human insulin, gene therapy for ADA deficiency; molecular diagnosis: PCR, ELISA; transgenic animals, ethical issues, biopiracy).
- **Unit 10: Ecology and Environment**: Ch 11: Organisms and Populations (Organism and abiotic factors, adaptations, population attributes: growth models: exponential vs logistic growth equations $dN/dt = rN(1 - N/K)$; population interactions: mutualism, competition, predation, parasitism, commensalism, amensalism), Ch 12: Ecosystem (Ecosystem structure, productivity: GPP, NPP; decomposition process, energy flow through trophic levels, ecological pyramids of number, biomass, energy; ecological succession: primary and secondary, hydrarch and xerarch), Ch 13: Biodiversity and Its Conservation (Levels of biodiversity, species diversity patterns: latitudinal gradients, species-area relationship $\log S = \log C + Z \log A$; importance of biodiversity, causes of biodiversity losses: the evil quartet; in-situ conservation: national parks, biosphere reserves; ex-situ conservation: botanical gardens, seed banks, cryopreservation).

#### E. Class 12 Artificial Intelligence (CBSE Subject Code 843)
- **Part A: Employability Skills**: Advanced communication, self-management, ICT, entrepreneurship, green skills.
- **Part B: Subject Specific Skills**:
  - **Unit 1: Advanced Machine Learning and Model Evaluation**: Advanced regression and classification, ensemble methods: Random Forest, Gradient Boosting (XGBoost overview), Cross-Validation ($K$-Fold, Stratified $K$-Fold), Bias-Variance tradeoff, ROC-AUC curve analysis.
  - **Unit 2: Deep Learning Foundations**: Multilayer Perceptrons (MLP), forward propagation, activation functions (Sigmoid, Tanh, ReLU, Leaky ReLU, Softmax), backpropagation algorithm, loss functions, optimizers (SGD, Adam).
  - **Unit 3: Computer Vision with Convolutional Neural Networks (CNN)**: Convolution operation, kernel/filter, stride, padding, pooling layers (Max Pooling, Average Pooling), Flattening and Dense layers, CNN architectures (LeNet, AlexNet concepts), transfer learning overview.
  - **Unit 4: Natural Language Processing with Deep Learning**: Word embeddings (Word2Vec, GloVe), Recurrent Neural Networks (RNN) and vanishing gradient problem, Long Short-Term Memory (LSTM), Attention mechanism and Transformers conceptual introduction (BERT, GPT architecture concepts).
  - **Unit 5: AI Capstone Project Deployment**: Building web apps with Streamlit / Flask, deploying ML models, API endpoints, model monitoring for drift (concept drift, data drift).
  - **Unit 6: AI Governance, Safety & Deployment Ethics**: Bias auditing, explainable AI (XAI: SHAP, LIME), data privacy compliance (GDPR, Indian DPDP Act 2023), responsible AI lifecycle.

---

## 5. Rich Question Data Specification

Every academic question generated for AIOS must adhere to the standardized schema below.

### 5.1. Question Core Schema Structure

```typescript
interface AcademicQuestionData {
  // Identity & Curriculum Hierarchy
  curriculum: {
    board: "CBSE" | "NCERT" | "ICSE" | "STATE_BOARD";
    grade: "Class 8" | "Class 9" | "Class 10" | "Class 11" | "Class 12";
    curriculumVersion: "2024-25" | "2025-26" | "2026-27 NEP Edition";
    subject: string; // e.g. "Mathematics", "Science", "Physics", "Artificial Intelligence"
    unitNumber: number;
    unitName: string;
    chapterNumber: number;
    chapterName: string;
    topic: string;
    subTopic?: string;
    concept: string; // Atomic concept evaluated
    learningObjective: string; // e.g. "MATH.10.04.02"
    prerequisiteConcepts: string[]; // Concept slugs that must be mastered first
  };

  // Question Definition
  question: {
    questionType: QuestionType; // 30+ defined types
    difficulty: "EASY" | "MEDIUM" | "HARD";
    bloomsLevel: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
    marks: number;
    expectedTimeSeconds: number;
    language: "en" | "hi";
    questionText: string; // LaTeX formatted for all equations ($...$ and $$...$$)
    options: QuestionOption[] | null; // Null for subjective/numerical
    correctAnswer: string; // Exact value, letter, or model summary
    solution: string; // Step-by-step complete worked solution in LaTeX
    explanation: string; // Conceptual intuition and pedagogical commentary
    hints: string[]; // 1 to 3 progressive hints for remedial practice
    rubric: MarkingRubricStep[] | null; // For questions >= 2 marks
    typePayload: Record<string, any>; // Subject-specific structured payload
    tags: string[]; // Search and indexing keywords
  };

  // Source Provenance
  source: {
    bookName: string; // e.g. "NCERT Class 10 Mathematics", "RD Sharma"
    edition: string;
    chapterNumber: number;
    exerciseNumber?: string; // e.g. "Exercise 4.4", "In-text Question"
    questionNumber?: string; // e.g. "Q2 (ii)"
    pageNumber?: number;
    sourceType: "NCERT_TEXTBOOK" | "NCERT_EXEMPLAR" | "PREVIOUS_BOARD_EXAM" | "TEACHER_CREATED" | "AI_GENERATED" | "REFERENCE_BOOK";
  };

  // Variant & Family Clustering
  variation: {
    familyId: string; // Unique group ID, format: QFAM-{SUBJECT}-{GRADE}-{CH}-{TOPIC}-{SEQ}
    variantType: "ORIGINAL" | "REPHRASED" | "PARAMETERIZED" | "CONCEPT_VARIANT" | "DIFFICULTY_VARIANT" | "CONTEXT_VARIANT";
    isParent: boolean;
    parentQuestionRef?: string;
  };
}

interface QuestionOption {
  id: "A" | "B" | "C" | "D" | "E";
  text: string; // LaTeX enabled
  isCorrect: boolean;
  explanation?: string; // Why this distractor was chosen / common student trap
}

interface MarkingRubricStep {
  stepNumber: number;
  stepDescription: string;
  marksAwarded: number;
}
```

---

## 6. Complete Question Taxonomy (Supported `questionType` Values)

The `questionType` field must be strictly populated with one of the following canonical strings:

### 1. Objective Formats
- `MCQ_SINGLE_CORRECT`: Standard 4 options, exactly one correct option.
- `MCQ_MULTIPLE_CORRECT`: 4–5 options, 1 or more options correct.
- `TRUE_FALSE`: Binary statement evaluation.
- `MULTIPLE_SELECT`: Checkbox list selecting all applicable cases.
- `FILL_IN_THE_BLANK`: Single or multi-blank sentences. Blank represented by `__________`.
- `MATCH_THE_FOLLOWING`: Two parallel columns (Column I and Column II) with pairing codes.
- `ASSERTION_AND_REASON`: Standard CBSE 4-choice Assertion & Reason format.
- `STATEMENT_BASED`: Statement I and Statement II validation.
- `SEQUENCE_ORDERING`: Chronological or procedural sequence arrangement.
- `ONE_WORD_ANSWER`: Exact string, scientific term, or single numerical value.

### 2. Numerical & Mathematical Formats
- `NUMERICAL`: Pure integer or decimal calculation with tolerance.
- `EQUATION_BASED`: Algebraic formulation or symbolic equivalence.
- `CALCULATION_BASED`: Multi-step computational word problem.
- `DERIVATION`: Formal mathematical or physical theorem deduction.
- `PROOF`: Geometric, trigonometric, or inductive theorem proof.
- `GRAPH_INTERPRETATION`: Reading slopes, intercepts, or areas from described graphs.
- `DATA_INTERPRETATION`: Analyzing statistical tables, frequency tables, or bar charts.

### 3. Descriptive Formats
- `VERY_SHORT_ANSWER`: 1–2 sentences / 1–2 marks.
- `SHORT_ANSWER`: 1 paragraph / 3 marks.
- `LONG_ANSWER`: Detailed analytical answer / 5 marks.
- `ESSAY`: Extended thematic response.
- `EXPLAIN_DESCRIBE`: Scientific mechanism or process explanation.
- `COMPARE_DIFFERENTIATE`: Tabular comparative differences.
- `JUSTIFY_GIVE_REASON`: Causal explanation defending a claim.

### 4. Visual Formats
- `DIAGRAM_BASED`: Question anchored on a described scientific or geometric figure.
- `DIAGRAM_LABELING`: Identifying marked parts (A, B, C, D) on a diagram.
- `IMAGE_BASED`: Real-world photo, historical artifact, or specimen analysis.
- `FIGURE_INTERPRETATION`: Physics apparatus or engineering layout diagram.
- `GRAPH_BASED`: Function curve or experimental coordinate plot.
- `MAP_BASED`: Geography/History map location identification or labeling.

### 5. Competency & Advanced Formats (NEP-2020 Aligned)
- `CASE_STUDY`: Comprehensive real-world scenario with 3–4 sub-questions.
- `CASE_BASED`: Standard CBSE 4-mark passage with sub-parts (i), (ii), (iii).
- `SOURCE_BASED`: Historical archive, treaty excerpt, or government act with sub-questions.
- `PASSAGE_BASED`: Reading comprehension text with analytical questions.
- `APPLICATION_BASED`: Applying classroom concepts to daily life or engineering situations.
- `COMPETENCY_BASED`: Practical problem-solving without direct textbook rote recall.
- `HOTS`: Higher Order Thinking Skills requiring multi-concept synthesis.
- `REAL_WORLD_SCENARIO`: Situational decision-making and policy choice.

### 6. Technical & Computer Science Formats
- `CODE_OUTPUT`: Predicting console output of code snippets.
- `DEBUGGING`: Identifying and correcting syntax or logical bugs in code.
- `CODE_COMPLETION`: Filling missing blocks in an algorithm.
- `PROGRAMMING_PROBLEM`: Full algorithmic problem with input/output test cases.
- `ALGORITHMIC_PROBLEM`: Pseudocode design, time/space complexity analysis.
- `SQL_QUERY`: Database query formulation against a schema.

---

## 7. Question Family & Variation Engineering

To prevent students from seeing identical questions during repeated practice or paper generation, every question must belong to a **Question Family (`familyId`)** and be tagged with a distinct **`variantType`**.

```
[ QuestionFamily: QFAM-MATH-10-QUAD-ROOTS-01 ]
       │
       ├── (1) ORIGINAL: "Find the roots of x^2 - 5x + 6 = 0."
       │       [Roots: 2, 3 | Difficulty: EASY | Blooms: APPLY]
       │
       ├── (2) PARAMETERIZED: "Find the roots of x^2 - 7x + 12 = 0."
       │       [Roots: 3, 4 | Exact same formula, different coefficients]
       │
       ├── (3) REPHRASED: "Determine the values of x that satisfy x^2 - 5x + 6 = 0."
       │       [Same values, altered linguistic framing]
       │
       ├── (4) CONCEPT_VARIANT: "If one root of x^2 - 5x + k = 0 is 2, find k and the other root."
       │       [Reverse reasoning on roots and coefficients]
       │
       ├── (5) DIFFICULTY_VARIANT: "Find the roots of 2x^2 - (√3 + 1)x + √3 = 0."
       │       [Same concept, irrational coefficients, higher cognitive load]
       │
       └── (6) CONTEXT_VARIANT: "The area of a rectangular garden is 6 sq meters and its perimeter is 10 meters. Find its dimensions."
               [Word problem / modeling translation into x^2 - 5x + 6 = 0]
```

### Variant Creation Rules:
1. **Never create trivial typographical changes** (e.g. replacing "Calculate" with "Compute" alone is invalid).
2. **Parameterized variants** must yield clean, academically sound solutions (avoid random numbers that produce messy non-terminating decimals unless intended).
3. **Paper Generator Guarantee:** The paper builder engine will never select two questions having the same `familyId` in the same test paper.

---

## 8. Question Volume & Coverage Matrix (Per Chapter)

To ensure that the AIOS Question Bank has sufficient depth to generate **at least 15 unique, non-repeating personalized test papers**, every chapter must satisfy the following minimum question quotas:

| Subject / Stream | Minimum Questions Per Chapter | Recommended Question Families | Question Type Distribution | Difficulty Mix |
| :--- | :--- | :--- | :--- | :--- |
| **Mathematics (Classes 8–10)** | 60–80 questions | 15–20 families (3–4 variants each) | 30% MCQ, 25% Numerical, 20% Proof/Short, 15% Long, 10% Case-Based | 30% Easy, 50% Medium, 20% Hard |
| **Science (Classes 8–10)** | 70–90 questions | 20–25 families | 25% MCQ, 15% Assertion-Reason, 30% Short, 15% Long, 15% Case/HOTS | 30% Easy, 50% Medium, 20% Hard |
| **Social Science (Classes 8–10)** | 60–80 questions | 15–20 families | 30% MCQ/Ordering, 25% Short, 25% Long, 10% Source-Based, 10% Map | 35% Easy, 45% Medium, 20% Hard |
| **AI (Classes 9–10)** | 40–50 questions | 10–15 families | 40% MCQ, 20% Code Output, 20% Conceptual, 20% Project/Scenario | 30% Easy, 50% Medium, 20% Hard |
| **Mathematics (Classes 11–12)** | 80–100 questions | 20–25 families | 25% MCQ, 30% Short, 25% Long/Proof, 20% Case-Based | 20% Easy, 50% Medium, 30% Hard |
| **Physics (Classes 11–12)** | 80–100 questions | 20–25 families | 25% MCQ/A&R, 35% Numerical, 20% Derivation, 20% Case Study | 20% Easy, 50% Medium, 30% Hard |
| **Chemistry (Classes 11–12)** | 80–100 questions | 20–25 families | 25% MCQ/A&R, 25% Reaction/Mechanism, 25% Numerical/Physical, 25% Reasoning | 25% Easy, 50% Medium, 25% Hard |
| **Biology (Classes 11–12)** | 70–90 questions | 20–25 families | 35% MCQ/A&R, 30% Short/Diagram, 25% Long, 10% Case Study | 30% Easy, 50% Medium, 20% Hard |
| **AI (Classes 11–12)** | 50–60 questions | 15–20 families | 30% MCQ, 30% Python/Code, 20% Applied ML, 20% Ethics/Case | 25% Easy, 50% Medium, 25% Hard |

---

## 9. Subject-Specific Payload Specifications (`typePayload`)

The `typePayload` JSONB field stores domain-specific data required for automated validation, evaluation, and rich frontend rendering:

### 1. Mathematics `typePayload`
```json
{
  "calculatorAllowed": false,
  "formulaUsed": "D = b^2 - 4ac",
  "graphRequired": false,
  "precisionTolerance": 0.01,
  "proofTechnique": "contradiction" // Optional: "induction", "contrapositive", "direct"
}
```

### 2. Science (Physics / Chemistry / Biology) `typePayload`
```json
// Chemistry
{
  "discipline": "CHEMISTRY",
  "reactionType": "REDOX",
  "balancedEquation": "MnO2 + 4HCl -> MnCl2 + 2H2O + Cl2",
  "physicalStatesMandatory": true,
  "reagents": ["MnO2", "HCl"]
}

// Physics
{
  "discipline": "PHYSICS",
  "siUnits": ["m/s", "N", "J"],
  "numericalTolerance": 0.05,
  "circuitDiagramDesc": "Battery 12V in series with resistor R1=10 ohm and R2=20 ohm"
}

// Biology
{
  "discipline": "BIOLOGY",
  "diagramRef": "human_heart_cross_section",
  "labels": [
    { "letter": "A", "anatomicalName": "Right Atrium" },
    { "letter": "B", "anatomicalName": "Left Ventricle" }
  ]
}
```

### 3. Social Science `typePayload`
```json
// History (Chronology & Timeline)
{
  "discipline": "HISTORY",
  "timeline": [
    { "event": "Non-Cooperation Movement", "year": 1920 },
    { "event": "Chauri Chaura Incident", "year": 1922 }
  ]
}

// Geography (Map Work)
{
  "discipline": "GEOGRAPHY",
  "mapType": "INDIA_POLITICAL",
  "coordinatesOrState": [
    { "feature": "Hirakud Dam", "river": "Mahanadi", "state": "Odisha" }
  ]
}
```

### 4. Artificial Intelligence `typePayload`
```json
{
  "programmingLanguage": "python3",
  "codeSnippet": "def predict(x):\n    return 1 if x > 0.5 else 0",
  "testCases": [
    { "input": "0.7", "expectedOutput": "1" },
    { "input": "0.3", "expectedOutput": "0" }
  ],
  "mlDomain": "COMPUTER_VISION" // or "NLP", "DATA_SCIENCE", "ETHICS"
}
```

---

## 10. Data Ingestion Pipeline & Database Mapping

When JSON files generated according to this specification are imported, they map directly to AIOS Prisma models in `packages/db/prisma/schema.prisma`:

| JSON Specification Field | Prisma Model / Target Field | Integrity & Relation Constraint |
| :--- | :--- | :--- |
| `curriculum.board` | `AcademicBoard.code` | Unique constraint lookup (`boardId`) |
| `curriculum.grade` | `GradeLevel.name` | Unique constraint lookup (`gradeLevelId`) |
| `curriculum.curriculumVersion` | `CurriculumVersion.versionYear` | Links to `curriculumVersionId` |
| `curriculum.subject` | `Subject.name` | Scoped to board + grade |
| `curriculum.chapterNumber` | `Chapter.orderIndex` | Scoped to subject |
| `curriculum.topic` | `Topic.name` | Scoped to chapter |
| `curriculum.concept` | `Concept.name` | Scoped to topic |
| `curriculum.prerequisiteConcepts` | `ConceptPrerequisite` | Directed Acyclic Graph (DAG) records |
| `curriculum.learningObjective` | `LearningObjective.code` | Mapped via `QuestionLearningObjective` |
| `variation.familyId` | `QuestionFamily.code` | Unique container for anti-duplication |
| `question.questionType` | `Question.type` | Validated against `QuestionType` enum |
| `question.bloomsLevel` | `Question.bloomsLevel` | Validated against `BloomsTaxonomyLevel` |
| `question.difficulty` | `Question.difficulty` | Validated against `Difficulty` enum |
| `question.typePayload` | `Question.typePayload` | Validated JSONB column |
| `question.rubric` | `Question.rubric` | Structured JSONB step-marking array |
| `question.contentHash` | `Question.contentHash` | Auto-computed SHA-256 hash on import |
| `question.fingerprint` | `Question.fingerprint` | Auto-computed stemmed token hash on import |

---

## 11. Execution Protocol for Claude (Chapter-by-Chapter Extraction)

To extract textbook data without hitting LLM output token limits, execution must be performed **one chapter at a time** using the standardized directory and file structure:

```
data/
└── academic/
    ├── class-08/
    │   ├── mathematics/
    │   │   ├── ch-01-rational-numbers.json
    │   │   └── ch-02-linear-equations.json
    │   ├── science/
    │   │   ├── ch-01-crop-production.json
    │   │   └── ch-02-microorganisms.json
    │   ├── social-science/
    │   └── artificial-intelligence/
    ├── class-09/
    ├── class-10/
    ├── class-11/
    │   ├── mathematics/
    │   ├── physics/
    │   ├── chemistry/
    │   ├── biology/
    │   └── artificial-intelligence/
    └── class-12/
        ├── mathematics/
        ├── physics/
        ├── chemistry/
        ├── biology/
        └── artificial-intelligence/
```

### The Exact Command to Run with Claude:

```text
Please read the attached chapter text/PDF or syllabus for:
Grade: [e.g. Class 10]
Subject: [e.g. Mathematics]
Chapter: [e.g. Chapter 4: Quadratic Equations]

Generate the complete production question bank dataset for this entire chapter following strictly the AIOS Academic Data Master Specification (v2.0.0).

REQUIREMENTS:
1. Generate between 60 to 80 questions covering ALL topics, subtopics, and concepts.
2. Group questions into 15 to 20 distinct Question Families (familyId).
3. For each concept, include the ORIGINAL, PARAMETERIZED, REPHRASED, and CONCEPT_VARIANT versions.
4. Output strictly a single valid JSON array matching the AcademicQuestionData schema.
5. All equations must use standard LaTeX ($...$ and $$...$$).
6. Provide complete step-by-step solutions and marking rubrics.
```

---

## 12. Automated Quality Control & Validation Rules

Before any generated JSON file is imported into the database, it must pass the AIOS validation test:

1. **JSON Syntax Integrity:** File must parse cleanly as a valid JSON array (`JSON.parse()`).
2. **No Empty Fields:** `questionText`, `solution`, `correctAnswer`, `concept`, and `topic` must be non-empty strings.
3. **MCQ Consistency:** If `questionType` is `MCQ_SINGLE_CORRECT`, `options` array must contain exactly 4 items with unique IDs (`A`, `B`, `C`, `D`), and exactly one item must have `isCorrect: true`.
4. **LaTeX Delimiter Balance:** All `$` and `$$` signs must have matching closing delimiters.
5. **Rubric Sum Match:** For all questions with a `rubric` array, the sum of `marksAwarded` across all steps must equal `marks`.
6. **No Self-Referencing Prerequisites:** A concept cannot have itself as a prerequisite.
7. **Unique Family IDs:** A `familyId` must uniquely identify a specific conceptual family.

---
*End of Master Specification — AIOS Academic Content Engineering Architecture.*
