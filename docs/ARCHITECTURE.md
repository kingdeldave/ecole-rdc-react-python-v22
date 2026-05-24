# Architecture technique

## Vue générale

```txt
React TypeScript Tailwind
        |
        | HTTPS / JSON / JWT
        v
FastAPI Python
        |
        | SQLAlchemy
        v
PostgreSQL / Supabase PostgreSQL
        |
        +-- Supabase Storage privé pour PDF, Excel, lettres
```

## Principe multi-école

Toutes les tables sensibles portent `school_id`. Le backend filtre les données selon :

- rôle connecté ;
- école de l’utilisateur ;
- lien parent-enfant ;
- classe/cours affecté à l’enseignant.

## Rôles principaux

- `SUPER_ADMIN` : supervise la plateforme.
- `ADMIN_ECOLE` : gère son école.
- `PREFET` et `DIRECTEUR` : valident, publient, corrigent officiellement les bulletins.
- `ENSEIGNANT` : saisit uniquement ses points.
- `COMPTABLE` : gère frais et paiements.
- `PARENT` : consulte les bulletins publiés de ses enfants si paiement en ordre.
- `ELEVE` : consultation limitée.

## Workflow bulletin

1. Saisie des points.
2. Génération du bulletin.
3. Calcul total, pourcentage, classement.
4. Validation par Préfet/Directeur.
5. Publication au parent.
6. Verrouillage du bulletin publié.
7. PDF avec filigrane.
8. Signature numérique du parent.
9. Historique et audit logs.

## Sécurité documentaire

Le code génère localement les PDF pour le développement. En production :

- bucket Supabase Storage privé ;
- signed URL courte ;
- contrôle serveur avant chaque téléchargement ;
- filigrane personnalisé ;
- log de chaque consultation/téléchargement ;
- alerte en cas de téléchargements répétés.
