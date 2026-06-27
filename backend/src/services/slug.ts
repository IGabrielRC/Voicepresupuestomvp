import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
export const newSlug = customAlphabet(alphabet, 12);
