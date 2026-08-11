// Every line the host says that is not a clue.
//
// Same six defect rules apply. Note what is absent by design: no product name,
// no field names, no score expressed in units of time, and never the plural of
// "interruption". The score is always spoken as a count of words.

export const SPOKEN_COPY = {
  welcome:
    'Welcome to the show. I will read you a clue. The moment you know the answer, say the word and cut me off. Every word I never got to say is a point.',

  roundStart:
    'Here is your first clue. Listen closely, and do not wait for me to finish.',

  nextClue: 'Next clue. Same rules.',

  finalClue: 'Last one. Make it count.',

  reversalWarning:
    'Careful with this one. It might not go where you think it is going.',

  correct: 'That is right. Nicely done.',

  wrong: 'Not this time. No points on that one.',

  noBuzz:
    'You let me finish that one. Nothing scored, because nothing was left unsaid.',

  runningOut: 'I am nearly at the end here.',

  goodbye:
    'That is the show. Thanks for playing, and try to cut me off sooner next time.',
};
