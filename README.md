# Révisions Terminale

Application web personnelle qui indique **quoi réviser et quand**, en fonction des
échéances (devoirs, contrôles, bac blanc...) et des points faibles, avec un
algorithme déterministe (pas d'IA au runtime, pas de coût par token).

Installable sur iPhone en "Ajouter à l'écran d'accueil" depuis Safari.

## Stack

- Vite + React + TypeScript, PWA (`vite-plugin-pwa`)
- Supabase (Postgres + Auth) pour la persistance et la synchronisation des données
- Déploiement gratuit sur GitHub Pages via GitHub Actions (nécessite un
  dépôt public — Pages est payant pour les dépôts privés)

Si Supabase n'est pas configuré, l'appli fonctionne quand même en local
(stockage `localStorage` du navigateur) — pratique pour développer/tester,
mais pas recommandé en usage final (les données ne survivent pas à un
vidage du cache et ne sont pas synchronisées entre appareils).

## Développement local

```bash
npm install
npm run dev
```

Ouvre l'URL affichée (ex: http://localhost:5173).

## Configurer Supabase (recommandé)

1. Crée un compte sur https://supabase.com et un nouveau projet (gratuit).
2. Dans le projet Supabase : **SQL Editor** → nouvelle requête → colle le
   contenu de [`supabase/schema.sql`](./supabase/schema.sql) → **Run**.
3. Dans **Authentication → Providers**, vérifie que "Email" est activé.
   Pour un usage strictement personnel, tu peux désactiver la confirmation
   par email dans **Authentication → Settings** pour te connecter
   immédiatement après inscription.
4. Dans **Project Settings → API**, récupère :
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
5. Copie `.env.example` vers `.env` et renseigne ces deux valeurs pour le
   développement local.

La clé `anon` n'est pas un secret classique : elle est conçue pour être
publique côté client, la sécurité vient des policies RLS définies dans
`schema.sql` (chaque utilisateur ne voit que ses propres données).

## Déployer sur GitHub Pages

GitHub Pages est gratuit uniquement pour les dépôts **publics** (un dépôt
privé nécessite un plan payant). Le code source de l'appli ne contient
aucune donnée personnelle (tes matières, chapitres, échéances vivent dans
Supabase, pas dans le dépôt), donc rendre le dépôt public ne t'expose pas.

1. Dans le dépôt GitHub : **Settings → General → Danger Zone → Change
   visibility → Make public**.
2. Toujours dans **Settings → Pages → Build and deployment → Source**,
   sélectionne **GitHub Actions**.
3. Dans **Settings → Secrets and variables → Actions**, ajoute les secrets
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (mêmes valeurs que dans
   `.env`).
4. Pousse sur `main` (ou relance le workflow depuis l'onglet **Actions**) :
   le workflow [`deploy.yml`](./.github/workflows/deploy.yml) build et
   publie automatiquement. L'URL est visible dans l'onglet **Actions** puis
   dans **Settings → Pages**.

## Installer sur iPhone

Ouvre l'URL GitHub Pages dans **Safari** → bouton Partager → **Sur l'écran
d'accueil**. L'appli s'ouvre alors en plein écran, comme une vraie appli.

## Format d'import des chapitres (CSV/JSON)

Colonnes CSV : `matiere,chapitre,sous_chapitre,ordre` (`sous_chapitre` et
`ordre` optionnels). Voir [`Import.tsx`](./src/pages/Import.tsx) → bouton
"Télécharger un exemple" pour un fichier de référence.

```csv
matiere,chapitre,sous_chapitre,ordre
Mathématiques,Suites numériques,,1
Mathématiques,Fonction exponentielle,,2
Histoire-Géographie,La guerre froide,Origines et débuts,1
Histoire-Géographie,La guerre froide,La détente,2
```

Une matière avec un nom déjà existant est réutilisée automatiquement ; les
nouveaux chapitres importés démarrent avec le statut "À faire".

**Astuce** : pour transformer une photo du sommaire d'un livre en fichier
d'import, demande à Claude (dans une nouvelle conversation, en joignant la
photo) de générer un CSV avec exactement ces colonnes, à partir du sommaire
photographié. Importe ensuite ce fichier depuis l'onglet "Importer" de
l'appli (fonctionne aussi directement depuis Safari sur iPhone).

## Algorithme de planning

Dans [`src/lib/scheduler.ts`](./src/lib/scheduler.ts) : pour chaque chapitre,
un score d'urgence combine (a) la proximité de la prochaine échéance qui le
couvre, et (b) un poids selon son statut (point faible > en cours > à faire
> maîtrisé). Les chapitres sont ensuite triés par score et le temps
disponible du jour est réparti par blocs (réglables dans "Réglages") sur les
chapitres les mieux classés. Tout est recalculé à la volée à partir des
données actuelles — rien n'est stocké côté "plan".

## Structure du projet

```
src/
  lib/        logique métier (store de données, algorithme, import, auth)
  pages/      écrans (Aujourd'hui, Matières, Échéances, Importer, Réglages, Connexion)
  components/ composants partagés (navigation)
supabase/
  schema.sql  schéma de base de données + policies RLS à coller dans Supabase
.github/workflows/deploy.yml  déploiement automatique sur GitHub Pages
```
