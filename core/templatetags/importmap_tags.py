import json
from django.utils.safestring import mark_safe
from django import template
from django.contrib.staticfiles.storage import staticfiles_storage
from django.conf import settings

register = template.Library()


@register.simple_tag
def importmap_script():
    try:
        manifest = getattr(staticfiles_storage, 'hashed_files', {})

        if not manifest:
            return ''

        imports = {}
        for original in manifest.keys():
            if original.endswith('.js'):
                if any(original.startswith(prefix) for prefix in ['admin/', 'build/', 'dist/', 'pdfjs/']):
                    continue

                imports[original] = staticfiles_storage.url(original)

        importmap_json = json.dumps({"imports": imports}, indent=2)
        return mark_safe(f'<script type="importmap">{importmap_json}</script>')

    except Exception as e:
        print(f"Importmap error: {e}")
        return ''