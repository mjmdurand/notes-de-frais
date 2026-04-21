from .celery_app import celery_app

# Aucune tâche OCR — l'utilisateur saisit les données manuellement.
# Celery reste disponible pour d'éventuelles tâches futures (emails async, exports...).
