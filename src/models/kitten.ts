import { getModelForClass, prop } from "@typegoose/typegoose";

class Kitten {
    @prop({ type: () => String, required: false }) // Explicitly specify the type
    name?: string;
  }
  
  const KittenModel = getModelForClass(Kitten);
  
  export default KittenModel;