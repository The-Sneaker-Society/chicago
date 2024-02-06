export interface EmailSignUp {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface CreateEmailInput {
  firstName: string;
  lastName: string;
  email: string;
}
