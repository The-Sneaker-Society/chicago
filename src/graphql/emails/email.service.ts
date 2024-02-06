import EmailModel from '../../models/Email.model';

export const getAllEmails = async () => {
  return await EmailModel.find().exec();
};

export const addNewEmail = async (
  email: string,
  firstName: string,
  lastName: string
) => {
  console.log({ email, firstName, lastName });
  try {
    await EmailModel.create({ lastName, firstName, email });
    return true;
  } catch (error) {
    throw error;
  }
};
