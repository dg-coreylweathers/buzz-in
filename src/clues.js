// The clue bank.
//
// Every line here is spoken aloud by the host, so every line is subject to the
// six confirmed spoken-copy defects — enforced by scripts/check-clues.js, not
// by care alone.
//
// Two formats:
//   standard — the clue means what it sounds like.
//   reversal — the clue sounds like it is heading one way and flips at the
//              end. Buzzing early on a reversal is a genuine gamble, which is
//              the whole reason the format earns a tension cue (PRD 5.5).
//
// The buzz word never appears in any clue text. That is the actual
// echo-cancellation mitigation: the host must not speak the word the player
// says to buzz in.

export const CLUES = [
  {
    id: 'c01', kind: 'standard', category: 'Geography',
    text: 'This landlocked country is home to the highest peak on the African continent, a dormant volcano that stands alone above the surrounding plains and draws climbers from every corner of the world.',
    answer: 'Tanzania', accept: ['Tanzania'],
  },
  {
    id: 'c02', kind: 'reversal', category: 'Science',
    text: 'Every schoolchild learns that this planet is the hottest in our neighborhood because it sits closest to the sun, which is exactly the reasoning that gets the answer wrong, because the real answer is the planet just beyond it.',
    answer: 'Venus', accept: ['Venus'],
  },
  {
    id: 'c03', kind: 'standard', category: 'Literature',
    text: 'She published under a name that was not her own, wrote about a governess who refuses to be diminished, and gave English literature one of its most quietly furious narrators.',
    answer: 'Charlotte Bronte', accept: ['Charlotte Bronte', 'Charlotte Brontë', 'Bronte'],
  },
  {
    id: 'c04', kind: 'standard', category: 'History',
    text: 'This wall came down over the course of a single remarkable evening in nineteen eighty nine, largely because an official misread his own notes at a press conference and told everyone the crossings were open.',
    answer: 'Berlin Wall', accept: ['Berlin Wall', 'the Berlin Wall'],
  },
  {
    id: 'c05', kind: 'reversal', category: 'Food',
    text: 'This spice is famously the most valuable by weight, harvested by hand from the tiny threads inside a purple flower, and if you were about to say vanilla you have already lost the points.',
    answer: 'Saffron', accept: ['Saffron'],
  },
  {
    id: 'c06', kind: 'standard', category: 'Music',
    text: 'This composer wrote nine symphonies, went progressively deaf across his career, and conducted the premiere of his final one without being able to hear the applause behind him.',
    answer: 'Beethoven', accept: ['Beethoven', 'Ludwig van Beethoven'],
  },
  {
    id: 'c07', kind: 'standard', category: 'Geography',
    text: 'Two countries share the longest international border in the world, running nearly nine thousand kilometres, and the southern of the two is the one most people name first.',
    answer: 'Canada', accept: ['Canada'],
  },
  {
    id: 'c08', kind: 'reversal', category: 'Animals',
    text: 'This animal is the largest that has ever lived on earth, larger than any creature from the age of the dinosaurs, and it is alive right now in the ocean rather than extinct in a museum.',
    answer: 'Blue whale', accept: ['Blue whale', 'whale'],
  },
  {
    id: 'c09', kind: 'standard', category: 'Art',
    text: 'He cut off part of his own ear, sold almost nothing in his lifetime, and painted a night sky over a village that has since become the most reproduced image in the western canon.',
    answer: 'Van Gogh', accept: ['Van Gogh', 'Vincent van Gogh'],
  },
  {
    id: 'c10', kind: 'standard', category: 'Science',
    text: 'This element makes up roughly seventy eight percent of the air you are breathing right now, and yet almost nobody names it first when asked what air is mostly made of.',
    answer: 'Nitrogen', accept: ['Nitrogen'],
  },
  {
    id: 'c11', kind: 'reversal', category: 'Sports',
    text: 'This sport gave the world the marathon distance of twenty six miles and three hundred and eighty five yards, a figure that sounds ancient and Greek but was actually set in London so the race could finish in front of the royal box.',
    answer: 'Running', accept: ['Running', 'marathon', 'athletics', 'track and field'],
  },
  {
    id: 'c12', kind: 'standard', category: 'Film',
    text: 'This director made a film about a shark that barely appears on screen, largely because the mechanical one kept breaking down in the salt water, and accidentally invented the summer blockbuster.',
    answer: 'Steven Spielberg', accept: ['Spielberg', 'Steven Spielberg'],
  },
  {
    id: 'c13', kind: 'standard', category: 'History',
    text: 'She won two prizes in two different sciences, remains the only person ever to do so, and her notebooks are still too dangerous to handle without protection more than a century later.',
    answer: 'Marie Curie', accept: ['Marie Curie', 'Curie'],
  },
  {
    id: 'c14', kind: 'reversal', category: 'Language',
    text: 'This language has the most native speakers in the world by a wide margin, which is not English, and it is not Spanish or Hindi either despite both of those being very reasonable guesses.',
    answer: 'Mandarin', accept: ['Mandarin', 'Chinese', 'Mandarin Chinese'],
  },
  {
    id: 'c15', kind: 'standard', category: 'Geography',
    text: 'This river runs through ten countries, is the longest in its continent, and its source was argued about by explorers for the better part of two thousand years.',
    answer: 'Nile', accept: ['Nile', 'the Nile'],
  },
  {
    id: 'c16', kind: 'standard', category: 'Technology',
    text: 'She wrote what is widely considered the first published algorithm intended for a machine, working from notes on a calculating engine that was never actually finished in her lifetime.',
    answer: 'Ada Lovelace', accept: ['Ada Lovelace', 'Lovelace'],
  },
  {
    id: 'c17', kind: 'reversal', category: 'Food',
    text: 'This fruit is botanically a berry, which sounds like a trick until you learn that strawberries are not berries at all, and the fruit in question is the one you peel and slice on your cereal.',
    answer: 'Banana', accept: ['Banana', 'bananas'],
  },
  {
    id: 'c18', kind: 'standard', category: 'Space',
    text: 'This was the first artificial object placed into orbit around the earth, launched in nineteen fifty seven, and it did little more than emit a steady beep that anyone with a radio could hear.',
    answer: 'Sputnik', accept: ['Sputnik', 'Sputnik 1'],
  },
  {
    id: 'c19', kind: 'standard', category: 'Literature',
    text: 'This novel opens with a whaling voyage, contains an entire chapter on the colour white, and begins with three of the most quoted words in American fiction.',
    answer: 'Moby Dick', accept: ['Moby Dick', 'Moby-Dick'],
  },
  {
    id: 'c20', kind: 'reversal', category: 'Geography',
    text: 'This city is the capital of Australia, and no, it is not the one with the opera house, and it is not the one with the enormous tennis tournament either.',
    answer: 'Canberra', accept: ['Canberra'],
  },
  {
    id: 'c21', kind: 'standard', category: 'Science',
    text: 'This is the only metal that stays liquid at room temperature, was once used to cure hats and gently poison the hatters, and shares its name with a planet.',
    answer: 'Mercury', accept: ['Mercury'],
  },
  {
    id: 'c22', kind: 'standard', category: 'History',
    text: 'This structure was built over centuries by successive dynasties, is not in fact visible to the naked eye from orbit despite what everyone tells you, and stretches thousands of miles across northern China.',
    answer: 'Great Wall of China', accept: ['Great Wall', 'Great Wall of China'],
  },
  {
    id: 'c23', kind: 'reversal', category: 'Animals',
    text: 'This creature has three hearts and blue blood, can rewrite its own skin to match a rock in under a second, and despite all of that it usually lives only a year or two.',
    answer: 'Octopus', accept: ['Octopus'],
  },
  {
    id: 'c24', kind: 'standard', category: 'Music',
    text: 'This instrument has eighty eight keys in its modern form, was invented in Italy around seventeen hundred, and its full original name describes the two things it could do that the harpsichord could not.',
    answer: 'Piano', accept: ['Piano', 'pianoforte'],
  },
  {
    id: 'c25', kind: 'standard', category: 'Geography',
    text: 'This desert is the largest hot desert in the world, covers most of northern Africa, and is roughly the size of the entire United States.',
    answer: 'Sahara', accept: ['Sahara', 'the Sahara'],
  },
  {
    id: 'c26', kind: 'reversal', category: 'Science',
    text: 'Light from the sun takes about eight minutes to reach us, which means when you look up you are seeing the past, and the same is true of every single thing you have ever looked at.',
    answer: 'Eight minutes', accept: ['Eight minutes', 'eight', '8 minutes'],
  },
  {
    id: 'c27', kind: 'standard', category: 'Film',
    text: 'This film won the top prize at the academy awards after a famously wrong envelope was read out first, leaving two casts standing on the same stage in complete confusion.',
    answer: 'Moonlight', accept: ['Moonlight'],
  },
  {
    id: 'c28', kind: 'standard', category: 'History',
    text: 'This ship sank on its maiden voyage in nineteen twelve, carried far too few lifeboats for the people aboard, and lay undiscovered on the sea floor until nineteen eighty five.',
    answer: 'Titanic', accept: ['Titanic', 'the Titanic', 'RMS Titanic'],
  },
  {
    id: 'c29', kind: 'reversal', category: 'Language',
    text: 'The word that means fear of long words is itself absurdly long, which sounds like a joke somebody made up, and it very much is a joke somebody made up rather than a genuine clinical term.',
    answer: 'Hippopotomonstrosesquippedaliophobia', accept: ['Hippopotomonstrosesquippedaliophobia', 'a joke'],
  },
  {
    id: 'c30', kind: 'standard', category: 'Space',
    text: 'This is the largest planet in our neighbourhood, has a storm that has been raging for centuries, and could swallow every other planet put together with room left over.',
    answer: 'Jupiter', accept: ['Jupiter'],
  },
];

export const CLUE_KINDS = ['standard', 'reversal'];

export function getClue(id) {
  return CLUES.find((c) => c.id === id) || null;
}

export function cluesOfKind(kind) {
  return CLUES.filter((c) => c.kind === kind);
}
