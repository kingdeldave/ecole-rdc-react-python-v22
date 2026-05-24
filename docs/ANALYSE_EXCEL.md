# Analyse du modèle Excel fourni

## Feuilles détectées

- `BULLETIN` : feuille d’affichage officiel du bulletin, plage utile approximative `A1:M45`.
- `LISTE` : feuille des élèves et des points, plage utile approximative `A1:FE72`.
- `Feuil1` : feuille simple de liste de noms.

## Structure observée

### Feuille `LISTE`

Les premières colonnes contiennent les informations de l’élève :

- NOMS
- N° ID
- SEXE
- DATE DE NAISS
- CLASSE
- N° PERM
- PROVINCE
- VILLE
- COMMUNE
- ECOLE
- CODE

Ensuite, chaque branche/matière occupe plusieurs colonnes :

- 1er période
- 2è période
- Examen
- 3è période
- 4è période
- Examen

### Feuille `BULLETIN`

Le bulletin affiche :

- l’en-tête RDC / Ministère ;
- province, ville, commune, école ;
- identité de l’élève ;
- tableau des branches ;
- premier semestre : P1, P2, Examen, Total ;
- second semestre : P3, P4, Examen, Total ;
- total général ;
- pourcentage ;
- place ;
- décision finale et signatures.

## Traduction dans l’application

Dans l’application, on évite la structure plate Excel. On normalise en base :

- `students` pour les élèves ;
- `subjects` pour les branches ;
- `class_subjects` pour lier une branche à une classe et définir les maxima ;
- `grades` pour stocker chaque note par élève, branche et période ;
- `report_cards` pour stocker le bulletin calculé ;
- `report_card_versions` pour figer chaque version officielle publiée.

Le calcul du bulletin est fait dans `backend/app/services/report_cards.py`.
