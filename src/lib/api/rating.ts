import { rpc } from "./study-session";

export interface RatingPrompt {
  due: boolean;
  period: string;
}

export interface ProductRating {
  id: string;
  period: string;
  stars: number;
  comment: string | null;
}

export const ratingApi = {
  getPrompt: () => rpc<RatingPrompt>("rating.getPrompt", "query", undefined),

  submit: (input: { stars: number; comment?: string }) =>
    rpc<ProductRating>("rating.submit", "mutation", input),
};
