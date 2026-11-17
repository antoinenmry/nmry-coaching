-- Photos, vidéos et vocaux du chat : bucket privé (audit RGPD, novembre 2026).
-- À lancer UNIQUEMENT après le déploiement du relais /api/chat/media (sinon les médias ne s'affichent plus).
-- Les liens publics déjà partagés cessent de fonctionner ; l'appli passe par des URL signées d'une heure.
update storage.buckets set public = false where id = 'chat-attachments';

-- Vérification : doit afficher « false ».
select id, public from storage.buckets where id = 'chat-attachments';
