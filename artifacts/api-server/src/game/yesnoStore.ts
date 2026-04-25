let questions: string[] = [];

export function getYesNoQuestions(): string[] {
  return questions;
}

export function setYesNoQuestions(q: string[]): void {
  questions = q;
}

export function addYesNoQuestions(q: string[]): void {
  questions.push(...q);
}

export function clearYesNoQuestions(): void {
  questions = [];
}
