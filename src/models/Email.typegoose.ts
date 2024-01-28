import { getModelForClass, prop } from '@typegoose/typegoose';

class Email {
  @prop({ required: true })
  firstName!: string;

  @prop({ required: true })
  lastName!: string;

  @prop({ required: true, unique: true })
  email!: string;

  @prop({ required: true, default: true })
  subscribed!: boolean;

  @prop({ type: () => [String], default: [] })
  received!: string[];
}

const EmailModel = getModelForClass(Email);

export default EmailModel;
