# GitHub

## Repositorio
Esta carpeta es la raíz del repositorio nuevo de quinie.LA. No debe copiarse desde una ruta `starter/` ni inicializarse nuevamente si `.git` ya existe.

## Branches
- `main`: desplegable / protegida.
- `develop`: integracion opcional.
- feature branches: `feat/...`, `fix/...`.

## Reglas
- Prohibido commitear `.env`.
- PR debe pasar lint, typecheck, unit tests, build y smoke E2E.
- Proteger `main`.
- Activar Dependabot/alerts.
- Hacer commits por fase y tags `phase-1`, `phase-2`, `phase-3`.

## Primer push
```bash
git add .
git commit -m "feat: complete phase 1 product experience"
git branch -M main
git remote add origin <URL_DEL_REPOSITORIO>
git push -u origin main
```
