POST / api / projects /: projectId / env /: env / secrets / bulk  # Bulk create / update
DELETE / api / projects /: projectId / env /: env / secrets / bulk  # Bulk delete
    POST / api / projects /: projectId / env /: env /import        # Import from file
GET / api / projects /: projectId / env /: env /export        # Export secrets
POST / api / projects /: projectId / sync