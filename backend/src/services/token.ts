import { customAlphabet } from 'nanoid';

// URL-safe alphanumeric token used for unauthenticated contractor edit links.
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
export const newEditToken = customAlphabet(alphabet, 32);
