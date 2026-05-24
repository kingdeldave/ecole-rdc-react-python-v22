# École RDC — React + Python/FastAPI + PostgreSQL

Application web professionnelle pour une école en RDC : élèves, parents, enseignants, saisie des points type Excel, calcul automatique des bulletins, frais scolaires, publication sécurisée, notifications et audit logs.

## Stack

- Frontend : React, TypeScript, Vite, Tailwind CSS, React Router
- Backend : Python, FastAPI, SQLAlchemy, PostgreSQL
- Documents : génération PDF avec ReportLab, import/export Excel avec openpyxl
- Sécurité : JWT de développement, RBAC, verrouillage des bulletins publiés, logs d’audit
- Supabase : un dossier `supabase/` contient une base de schéma et des policies RLS indicatives pour migrer vers Supabase Auth + Storage privé.

## Logique reprise du fichier Excel

Le fichier Excel fourni contient :

- une feuille `LISTE` : élèves en lignes, matières en groupes de colonnes, périodes en sous-colonnes ;
- une feuille `BULLETIN` : affichage officiel du bulletin, récupération des données de `LISTE`, calcul des totaux, pourcentages et places ;
- une structure des périodes : 1ère période, 2ème période, examen S1, 3ème période, 4ème période, examen S2 ;
- un calcul : total 1er semestre, total 2ème semestre, total général, pourcentage, classement.

Dans cette application, Excel n’est pas la base principale. Les données sont stockées dans PostgreSQL ; Excel sert seulement de modèle logique.

## Démarrage rapide

### 1. Lancer PostgreSQL

```bash
cd ecole-rdc-react-python-v2
docker compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

API : http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Interface : http://localhost:5173

## Comptes de démonstration

Tous les comptes utilisent le mot de passe :

```txt
Password123!
```

| Rôle | Email |
|---|---|
| Super Admin | superadmin@plateforme.cd |
| Admin École | admin@matonge.cd |
| Préfet | prefet@matonge.cd |
| Directeur | directeur@matonge.cd |
| Enseignant | enseignant@matonge.cd |
| Comptable | comptable@matonge.cd |
| Parent | parent@matonge.cd |
| Élève | eleve@matonge.cd |

## Fonctionnalités déjà codées

- Authentification JWT de développement
- Redirection frontend selon rôle
- Dashboard selon rôle
- Gestion classes, élèves, branches/matières
- Saisie des points par période
- Validation des points : nombre uniquement, pas de format `93/80`, pas de dépassement du maximum
- Historique des modifications des points
- Calcul automatique du bulletin
- Classement automatique par classe
- Validation et publication du bulletin par direction
- Verrouillage du bulletin après publication
- Versioning des bulletins publiés
- Blocage bulletin selon frais scolaires
- Signature/accusé de réception parent
- Génération PDF avec filigrane
- Notifications
- Paiements/frais scolaires
- Audit logs

## Limite honnête

Ce projet est une base professionnelle complète pour démarrer. Pour une production réelle, il faut encore :

- remplacer le JWT local par Supabase Auth ou un fournisseur OAuth sécurisé ;
- stocker les PDF/Excel dans Supabase Storage en bucket privé ;
- générer des signed URLs à expiration courte ;
- renforcer toutes les policies RLS directement dans Supabase ;
- ajouter HTTPS, monitoring, sauvegardes, tests automatisés et CI/CD.

## Version v3 — tableaux de bord par rôle et règles métier renforcées

Cette version ajoute :

- dashboards différents selon le rôle connecté : élève, parent, professeur, direction, comptabilité, administration ;
- menu latéral filtré par rôle ;
- verrouillage automatique des points envoyés par les professeurs ;
- correction des points verrouillés réservée à la direction avec motif obligatoire ;
- blocage/déblocage des bulletins pour frais scolaires non régularisés ;
- notification automatique aux parents quand un bulletin est bloqué/débloqué ;
- bulletin PDF considéré comme document officiel avec QR code de vérification ;
- route publique de vérification du bulletin : `/api/v1/public/report-cards/{id}/verify` ;
- page publique React de vérification : `/verify/bulletin/{id}` ;
- module Cours en ligne : les professeurs publient des cours/consignes/liens ;
- module Discipline : sanction, suspension, renvoi, notification automatique au parent ;
- restriction parent : un parent ne voit que les bulletins de ses propres enfants.

### Important après mise à jour

Comme le modèle de base de données a changé, il est recommandé de réinitialiser la base de développement :

```cmd
docker compose down -v
docker compose up -d
cd backend
.venv\Scripts\activate
pip uninstall bcrypt -y
pip install bcrypt==4.0.1
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Puis dans un autre terminal :

```cmd
cd frontend
npm install
npm run dev
```


## Version v6 — interface élève/parent améliorée

Cette version ajoute :

- un écran de connexion avec identité visuelle d’école ;
- un portail élève et parent distinct, inspiré d’un espace scolaire moderne mais avec un design original ;
- un menu **Carte d’élève** à la place des éléments non pertinents comme Projet/Fiches ;
- une carte d’élève numérique avec matricule, classe, statut et QR de démonstration ;
- un filtrage backend : le parent ne voit que ses enfants, l’élève ne voit que sa propre fiche ;
- les cours publiés par les professeurs apparaissent dans le dashboard élève/parent ;
- les sanctions disciplinaires restent visibles dans l’espace parent/élève ;
- le bulletin reste protégé par QR code, filigrane, blocage financier et verrouillage après publication.

### Comptes de test

```txt
admin@matonge.cd
prefet@matonge.cd
directeur@matonge.cd
enseignant@matonge.cd
comptable@matonge.cd
parent@matonge.cd
eleve@matonge.cd
```

Mot de passe commun :

```txt
Password123!
```

### Lancement rapide

Terminal 1 :

```cmd
cd /d "C:\Users\kalod\OneDrive\Imágenes\ecole-rdc-react-python-v6"
docker compose up -d
```

Terminal 2 :

```cmd
cd /d "C:\Users\kalod\OneDrive\Imágenes\ecole-rdc-react-python-v6\backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip uninstall bcrypt -y
pip install bcrypt==4.0.1
copy .env.example .env
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Terminal 3 :

```cmd
cd /d "C:\Users\kalod\OneDrive\Imágenes\ecole-rdc-react-python-v6\frontend"
npm install
copy .env.example .env
npm run dev
```

Application : http://localhost:5173
API : http://localhost:8000/docs

## Notes interface v7

Cette version retravaille principalement l’interface : page de connexion, sidebar, topbar, dashboards par rôle, carte d’élève et intégration visuelle de la photo de l’école.

### Photo de l’école sur la page de connexion

Le frontend utilise le fichier :

```txt
frontend/public/1.jpg
```

Un visuel temporaire est déjà fourni. Pour utiliser votre vraie photo, remplacez simplement ce fichier par votre image réelle en gardant exactement le nom `1.jpg`.

### Sécurité côté interface

- Le mot de passe n’est plus prérempli à l’ouverture de la page.
- Les comptes de démonstration restent disponibles par boutons pour les tests.
- Les menus restent filtrés par rôle.
- Les écrans rappellent le verrouillage des bulletins, l’audit et la vérification QR.

## Version v8 — classes RDC, gestion élèves, blocage paiement et parent multi-enfants

Cette version ajoute les règles demandées pour le projet :

- classes préchargées : `1CO`, `2sec`, `3e H`, `4e H`, `5e H`, `6e H` ;
- correspondance utilisée : `1CO = 7ème`, `2sec = 8ème`, `3e H = 1ère Humanité`, `4e H = 2ème Humanité`, `5e H = 3ème Humanité`, `6e H = 4ème Humanité` ;
- ajout d’élève depuis l’interface **Élèves** ;
- suppression d’élève depuis l’interface **Élèves** ;
- statut financier visible dans la liste des élèves ;
- blocage/déblocage d’un élève pour frais scolaires ;
- si l’élève est bloqué, le parent et l’élève ne voient pas les points ni le détail du bulletin ;
- le PDF du bulletin reste interdit au parent/élève tant que le paiement n’est pas régularisé ;
- le compte parent de démonstration est lié à 4 enfants pour tester le suivi multi-élèves ;
- le dashboard parent affiche les enfants liés et permet de changer l’enfant suivi.

### Relancer après installation de la v8

Terminal 1 :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v8"
docker rm -f ecole_rdc_postgres
docker compose up -d
```

Terminal 2 :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v8\backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Terminal 3 :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v8\frontend"
npm install
copy .env.example .env
npm run dev
```


## Version v9 — Import massif des élèves depuis Excel

Cette version ajoute dans l'administration des élèves :

- import par collage direct depuis Excel/LibreOffice ;
- import d'un fichier `.xlsx` depuis l'interface ;
- colonnes acceptées : `matricule`, `nom`, `post_nom`, `prenom`, `sexe`, `date_naissance`, `lieu_naissance`, `adresse`, `observations` ;
- détection des doublons de matricule ;
- chaque élève importé est automatiquement rattaché à la classe sélectionnée ;
- chaque nouvel élève est bloqué par défaut côté résultats/bulletins tant que la comptabilité ne régularise pas le paiement ;
- les parents peuvent toujours avoir plusieurs enfants liés dans le système.

### Utilisation

Dans l'administration :

1. ouvrir **Élèves** ;
2. choisir la classe ;
3. cliquer sur **Importer une liste** ;
4. soit coller les lignes copiées depuis Excel, soit importer un fichier `.xlsx` ;
5. cliquer sur **Transformer en liste d'élèves**.

Exemple de colonnes :

```txt
matricule | nom | post_nom | prenom | sexe | date_naissance | lieu_naissance | adresse
```

## Version v10 — administration renforcée

Cette version ajoute les demandes suivantes :

- carte d’élève imprimable en recto/verso, proche du modèle physique fourni : face officielle RDC avec numéro ID, et face informations élève avec photo, école, classe, adresse, cachet et signature ;
- ajout de nouveaux cours/matières depuis l’interface `Cours / Matières` par l’administration, le préfet ou la direction ;
- maxima des cours modifiables depuis l’interface avec valeurs contrôlées : `10`, `20` ou `40` ;
- les calculs de points et bulletins utilisent toujours les maxima enregistrés dans la base ;
- modification des montants payés/dus depuis l’interface élèves ; chaque modification envoie une notification à la direction ;
- sanctions disciplinaires : la notification est envoyée aux parents de l’élève, à la direction, à l’administration et aux autres comptes actifs de l’école ;
- bouton de déverrouillage des points dans la page `Points`, réservé à la direction/préfecture, avec motif obligatoire ;
- import des élèves par collage Excel et fichier `.xlsx` conservé dans la page administration `Élèves`.

### Démarrage conseillé v10

Terminal 1 :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v10"
docker rm -f ecole_rdc_postgres
docker compose -f docker-compose.yml up -d
docker ps
```

Terminal 2 :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v10\backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Terminal 3 :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v10\frontend"
npm config set registry https://registry.npmjs.org/
npm install
copy .env.example .env
npm run dev
```

## Version v11 — utilisateurs, professeurs par cours et verrouillage précis

Cette version ajoute les points demandés pour une école réelle :

- interface **Utilisateurs** côté administration/direction ;
- création de plusieurs comptes : administrateurs, directeurs, préfets, professeurs, comptables, parents et élèves ;
- affichage des identifiants de connexion et du mot de passe de démonstration ;
- activation/désactivation de comptes depuis l’interface ;
- réinitialisation du mot de passe d’un utilisateur depuis l’interface ;
- plusieurs professeurs dans la base de démonstration ;
- chaque professeur ne voit que les cours qui lui sont attribués ;
- chaque professeur ne peut saisir que les points de ses propres cours, même si ces cours existent dans plusieurs classes ;
- ajout d’un professeur responsable lors de la création d’un nouveau cours/matière ;
- photos d’élèves dans la liste des élèves et sur la carte d’élève ;
- la direction peut verrouiller ou déverrouiller une note précise, élève par élève, au lieu de déverrouiller toute une classe ;
- bouton **Verrouiller / Déverrouiller** avec motif obligatoire côté direction ;
- les points saisis par la direction sont conservés côté direction et ne sont pas traités comme un envoi professeur ;
- parents multiples et élèves multiples dans les données de démonstration.

Comptes professeurs de test :

```txt
prof.math@matonge.cd
prof.francais@matonge.cd
prof.info@matonge.cd
prof.svt@matonge.cd
prof.histoire@matonge.cd
```

Mot de passe commun :

```txt
Password123!
```

## Version v12 — reprise propre utilisateurs, professeurs et parents

Cette version reprend proprement les règles demandées pour l’administration et la direction :

- interface **Utilisateurs** pour créer plusieurs administrateurs, directeurs, préfets, professeurs, comptables, parents et élèves ;
- affichage des identifiants et accès de test dans l’interface ;
- activation/désactivation des comptes ;
- réinitialisation de mot de passe ;
- rattachement d’un parent à plusieurs enfants depuis l’interface ;
- un parent peut avoir 1, 2, 3 ou 4 enfants ;
- un professeur ne voit que les classes où il enseigne au moins un cours ;
- un professeur ne voit que ses propres cours et ne peut saisir que ses points ;
- la direction peut verrouiller/déverrouiller une note élève par élève, avec motif obligatoire ;
- les élèves gardent leur photo dans la liste et sur la carte d’élève ;
- les classes de base restent : 1CO, 2sec, 3e H, 4e H, 5e H et 6e H ;
- les cours peuvent être ajoutés via l’interface avec maxima 10, 20 ou 40.

### Démarrage rapide v12

Vous pouvez utiliser les trois fichiers fournis :

```txt
LANCER_TERMINAL_1_DOCKER.cmd
LANCER_TERMINAL_2_BACKEND.cmd
LANCER_TERMINAL_3_FRONTEND.cmd
```

Ou lancer manuellement :

Terminal 1 :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v12"
docker rm -f ecole_rdc_postgres
docker compose -f docker-compose.yml up -d
```

Terminal 2 :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v12\backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Terminal 3 :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v12\frontend"
npm config set registry https://registry.npmjs.org/
npm install
copy .env.example .env
npm run dev
```

Application : http://localhost:5173  
API : http://localhost:8000/docs

## Version v13 — administration, profils, photos et notifications email

Cette version ajoute :

- modification des élèves depuis l’administration : correction de nom mal écrit, matricule, sexe, naissance, adresse, statut et photo ;
- export CSV de la liste des élèves depuis l’administration avec le bouton **Sortir la liste** ;
- barre de recherche dans la page **Élèves** pour les administrateurs et membres de la direction ;
- barre de recherche dans la page **Carte d’élève** pour retrouver rapidement un élève ;
- barre de recherche dans la page **Utilisateurs** ;
- page **Profil connecté** disponible pour tous les rôles ;
- ajout/modification de la photo du profil connecté ;
- affichage de la photo du profil dans la topbar ;
- photo d’élève modifiable depuis la fiche d’administration ;
- notifications visibles dans le site ;
- notification email préparée pour les parents : si SMTP est configuré, l’email part réellement ; sinon le statut est marqué `SIMULE_DEV` dans la notification.

### Email SMTP optionnel

Dans `backend/.env`, tu peux ajouter :

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=password
SMTP_FROM=noreply@example.com
```

Sans ces variables, l’application continue de fonctionner localement et simule l’envoi email.

## Version v14 — profils, rattachement parent, audit restaurable

Cette version ajoute :

- photo de profil pour chaque compte utilisateur ;
- modification de la photo d’un utilisateur depuis la page Utilisateurs ;
- affichage de la photo et du nom dans le bloc Profil connecté de la sidebar ;
- recherche par matricule, nom, post-nom ou classe pour rattacher rapidement un parent à ses enfants ;
- création de compte via une fenêtre modale plus visible ;
- alerte automatique à la direction lorsqu’un administrateur simple modifie une donnée sensible ;
- page Audit avec bouton Restaurer pour annuler une modification administrative non autorisée ;
- les actions du Préfet restent sous autorité de la préfecture et ne déclenchent pas l’alerte des autres utilisateurs.

Si la photo affiche `Failed to fetch`, cela signifie que le backend FastAPI n’est pas lancé ou que `frontend/.env` ne pointe pas vers `http://localhost:8000/api/v1`.

## Version v15 — rattrapage, TENASOP/BAC et verrouillage corrigé

Cette version corrige la logique de déverrouillage des notes : lorsqu'un élève précis est déverrouillé par la direction pour correction ou rattrapage, le professeur peut renvoyer uniquement la cote de cet élève sans être bloqué par les autres notes restées verrouillées.

Ajouts principaux :

- périodes supplémentaires dans la saisie des points : `Rattrapage`, `TENASOP`, `BAC` ;
- maxima configurables à 10, 20 ou 40 pour les périodes ordinaires, le rattrapage, le TENASOP et le BAC ;
- indicateurs dans la page Points : points remplis, non remplis, verrouillés, ouverts pour correction ;
- bulletin mis à jour : affichage du rattrapage, TENASOP et BAC dans la prévisualisation et dans le PDF ;
- calcul du bulletin adapté : les points de rattrapage/TENASOP/BAC sont ajoutés uniquement lorsqu'ils sont saisis ;
- la direction peut verrouiller/déverrouiller une note élève par élève avec motif obligatoire ;
- un professeur ne renvoie plus toute la classe si seules certaines notes ont été déverrouillées.

## Version v16 — profils enseignants, horaires et visibilité parent

Cette version ajoute :

- chaque utilisateur peut modifier son nom affiché, son numéro et sa photo dans **Profil connecté** ;
- chaque professeur possède un numéro de téléphone visible dans son profil et dans les cours ;
- les cours/matières ont désormais un horaire ou créneau : exemple `Lundi 08h00-09h00` ;
- un professeur voit dans son profil tous les cours qu’il donne, dans chaque classe, avec horaire ;
- un parent voit dans **Cours / Matières** les cours de ses enfants avec le nom du professeur, son numéro et l’heure du cours ;
- un élève voit les cours de sa classe avec les informations du professeur ;
- l’administration peut renseigner le numéro d’un utilisateur et assigner un professeur à un cours ;
- l’administration/direction peut compléter l’horaire d’un cours lors de l’ajout ou dans la modification des maxima.

Après extraction, relancer la base avec `python -m app.seed` pour créer les nouveaux champs `phone` et `schedule_label`.

## Version v17 — profils professeurs, horaires et visibilité parent/élève

Cette version reprend proprement le besoin suivant : chaque professeur possède un profil complet avec son nom, son numéro, sa photo et les cours qu’il donne. Les cours sont liés à une classe, à un horaire et à un professeur responsable.

Ajouts principaux :

- page **Professeurs / horaires** visible selon le rôle connecté ;
- professeur : voit uniquement ses propres cours, classes et horaires ;
- parent : voit les professeurs, numéros et horaires des cours de ses enfants ;
- élève : voit les professeurs, numéros et horaires des cours de sa classe ;
- administration/direction : voit l’annuaire complet des professeurs de l’école ;
- recherche par professeur, cours, classe, numéro ou horaire ;
- API dédiée `/api/v1/subjects/teachers-schedule` avec filtrage par rôle ;
- profil connecté conservé : chaque utilisateur peut modifier son nom, son numéro et sa photo.

### Comptes professeurs de test

```txt
enseignant@matonge.cd
prof.math@matonge.cd
prof.francais@matonge.cd
prof.info@matonge.cd
prof.svt@matonge.cd
prof.histoire@matonge.cd
```

Mot de passe commun :

```txt
Password123!
```

## Version v18 — adaptation mobile

Cette version améliore l’affichage sur téléphone :

- layout général plus compact sur petits écrans ;
- champs et boutons adaptés au tactile ;
- titres responsives pour éviter les débordements ;
- tableaux importants avec défilement horizontal propre ;
- carte d’élève consultable sur mobile sans casser la mise en page ;
- page de connexion plus propre sur téléphone ;
- `vite.config.ts` autorise les hôtes Cloudflare Tunnel pour les tests externes.

Pour tester sur téléphone via Cloudflare Tunnel, garder ouverts : Docker/PostgreSQL, backend, tunnel backend, frontend, tunnel frontend.

## v22 — Modules ajoutés

Cette version ajoute les modules demandés :

- import Excel des points par les professeurs (`matricule`, `note`) ;
- mot de passe oublié avec jeton de démonstration ;
- inscriptions et réinscriptions ;
- documents administratifs PDF : attestation de fréquentation, certificat de scolarité, fiche d’inscription, attestation de bonne conduite ;
- sauvegarde et restauration par snapshot JSON ;
- présence / absence avec notification parent ;
- horaire complet avec détection de conflits classe/professeur ;
- reçus de paiement PDF avec QR code ;
- bibliothèque : livres, exemplaires, prêts et retours ;
- complément RLS Supabase dans `supabase/schema_rls.sql`.

### Import Excel des points

Format accepté : fichier `.xlsx` avec au moins deux colonnes :

| matricule | note |
|---|---:|
| LTPM-0001 | 12 |
| LTPM-0002 | 15 |

Les notes avec slash comme `13/20` sont refusées. Les notes verrouillées restent protégées.

### Sécurité

La version locale utilise SQLAlchemy/FastAPI. Pour Supabase, les politiques RLS sont fournies comme script SQL dans `supabase/schema_rls.sql` et doivent être appliquées dans Supabase lors du passage en production.

## Version v23 — options scolaires, professeurs titulaires, examens et jury

Cette version ajoute les modifications demandées pour une école secondaire RDC :

- classes normalisées : `1CO = 7ème`, `2sec = 8ème`, `3e H = 1ère Humanité`, `4e H = 2ème Humanité`, `5e H = 3ème Humanité`, `6e H = 4ème Humanité` ;
- `1CO` et `2sec` restent sans option ;
- les humanités peuvent avoir des options/filières : Scientifique, Littéraire, Nutrition, Pédagogie, etc. ;
- nouvelle page administration **Classes / Options** pour créer les options, créer les classes, définir la salle, affecter les titulaires et rechercher les élèves ;
- plusieurs professeurs titulaires possibles par classe ;
- nouvelle page professeur **Mes classes titulaires** avec recherche d’élèves et calcul des bulletins ;
- protection financière : si l’élève est bloqué pour frais, le professeur titulaire ne voit pas le bulletin complet ;
- nouvelle page **Examens** : programmation d’examen par administration/direction/titulaire, notification dans l’application et email parent si SMTP est configuré ;
- les notifications parents d’examen n’affichent pas le nom du professeur ;
- nouvelle page **Points jury** : le professeur choisit son cours, vérifie les élèves, voit son nom avant envoi, puis envoie les points au jury ;
- le jury regroupe l’administration, la direction et le professeur titulaire ;
- import Excel complet des points par cours : `matricule`, `p1`, `p2`, `ex1`, `p3`, `p4`, `ex2`, avec `rattrapage`, `tenasop`, `bac` optionnels ;
- calcul des bulletins conservé sur la logique Excel : addition des points réels par période et par examen, selon les maxima réels. Exemple : `5/10 + 5/10 + 11/20 = 21/40`, le `11` ne devient pas `10` ;
- maxima autorisés élargis pour coller aux bulletins : `5`, `10`, `20`, `40`, `50`, `80`, `100`.

### Relance conseillée après cette mise à jour

Comme la base de données a de nouvelles tables et colonnes, il est recommandé de repartir sur une base propre en développement :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v22"
docker compose down -v
docker compose up -d
```

Puis :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v22\backend"
.venv\Scripts\activate
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Et dans un autre terminal :

```cmd
cd /d "C:\Users\kalod\Music\ecole-rdc-react-python-v22\frontend"
npm install
npm run dev
```
