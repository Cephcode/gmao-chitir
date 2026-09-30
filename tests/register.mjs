// Chargeur de test, sans dépendance : résout l'alias « @/ » de tsconfig vers la racine du
// projet (fichiers .ts), et remplace le client Supabase serveur (qui a besoin de Next)
// par un module vide. Utilisé par : node --test --import ./tests/register.mjs tests/*.test.ts
import { register } from "node:module";
register("./alias-hooks.mjs", import.meta.url);
