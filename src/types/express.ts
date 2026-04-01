import { Request } from "express";

export interface TypedRequest extends Request {
  rawBody?: string;
}
