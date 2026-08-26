# Révisions Terminale

Application web personnelle qui indique **quoi réviser et quand**, en fonction des
échéances (devoirs, contrôles, bac blanc...) et des points faibles, avec un
algorithme déterministe (pas d'IA au runtime, pas de coût par token).

Installable sur iPhone en "Ajouter à l'écran d'accueil" depuis Safari.

## Stack

- Vite + React + TypeScript, PWA (`vite-plugin-pwa`)
- Supabase (Postgres + Auth) pour la persistance et la synchronisation des données
- Déploiement gratuit sur Render (Static Site), déployé automatiquement à
  chaque push sur `main`

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

## Déployer sur Render

1. Crée un compte sur https://render.com (gratuit, connexion possible via
   GitHub).
2. **New → Static Site**, connecte le dépôt GitHub (autorise Render à accéder
   au dépôt s'il est privé).
3. Configuration du service :
   - **Build Command** : `npm ci && npm run build`
   - **Publish directory** : `dist`
4. Dans l'onglet **Environment** du service, ajoute les variables
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (mêmes valeurs que dans
   `.env`).
5. Render build et déploie automatiquement à chaque push sur `main`. L'URL
   du site (`https://....onrender.com`) est affichée en haut du dashboard du
   service.

Comme l'appli utilise un routeur "hash" (URLs du type `/#/matieres`), aucune
règle de réécriture serveur n'est nécessaire pour que la navigation
fonctionne sur Render.

## Installer sur iPhone

Ouvre l'URL Render dans **Safari** → bouton Partager → **Sur l'écran
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
```
