const fs = require('fs');

// 1. evaluation/ai_model_registry.py
const evalRegistryPath = 'apps/api-python/src/evaluation/ai_model_registry.py';
let evalContent = fs.readFileSync(evalRegistryPath, 'utf8');

const evalCacheDecl = `_MODEL_ID_CACHE = {}
_MODEL_VERSION_CACHE = {}
_PROMPT_VERSION_CACHE = {}

def clear_evaluation_registry_cache():
    _MODEL_ID_CACHE.clear()
    _MODEL_VERSION_CACHE.clear()
    _PROMPT_VERSION_CACHE.clear()
`;

evalContent = evalContent.replace(
  'from src.database import db\n',
  'from src.database import db\n\n' + evalCacheDecl + '\n'
);

const oldResolveEvalModelId = `async def resolve_evaluation_ai_model_id(provider_name: str = PROVIDER_NAME, model_name: str = MODEL_NAME) -> str:
    provider = await db.aiprovider.find_first(where={"name": provider_name})`;

const newResolveEvalModelId = `async def resolve_evaluation_ai_model_id(provider_name: str = PROVIDER_NAME, model_name: str = MODEL_NAME) -> str:
    key = (provider_name, model_name)
    if key in _MODEL_ID_CACHE:
        return _MODEL_ID_CACHE[key]
    provider = await db.aiprovider.find_first(where={"name": provider_name})`;

evalContent = evalContent.replace(oldResolveEvalModelId, newResolveEvalModelId);

evalContent = evalContent.replace(
  '    return model.id\n\n\nasync def resolve_active_evaluation_model_version',
  '    _MODEL_ID_CACHE[key] = model.id\n    return model.id\n\n\nasync def resolve_active_evaluation_model_version'
);

const oldResolveActiveEvalVersion = `async def resolve_active_evaluation_model_version(ai_model_id: str, version_label: str = VERSION_LABEL):
    """Returns the active AIModelVersion row, or None if evaluation is deconfigured.`;

const newResolveActiveEvalVersion = `async def resolve_active_evaluation_model_version(ai_model_id: str, version_label: str = VERSION_LABEL):
    """Returns the active AIModelVersion row, or None if evaluation is deconfigured.`;

evalContent = evalContent.replace(
  oldResolveActiveEvalVersion,
  `async def resolve_active_evaluation_model_version(ai_model_id: str, version_label: str = VERSION_LABEL):
    key = (ai_model_id, version_label)
    if key in _MODEL_VERSION_CACHE:
        return _MODEL_VERSION_CACHE[key]
    """Returns the active AIModelVersion row, or None if evaluation is deconfigured.`
);

evalContent = evalContent.replace(
  '    if version is not None:\n        return version',
  '    if version is not None:\n        _MODEL_VERSION_CACHE[key] = version\n        return version'
);

evalContent = evalContent.replace(
  '    return await db.aimodelversion.create(\n        data={"aiModelId": ai_model_id, "versionLabel": version_label, "isActive": True}\n    )',
  '    created = await db.aimodelversion.create(\n        data={"aiModelId": ai_model_id, "versionLabel": version_label, "isActive": True}\n    )\n    _MODEL_VERSION_CACHE[key] = created\n    return created'
);

evalContent = evalContent.replace(
  '    return prompt.id\n',
  '    _PROMPT_VERSION_CACHE[key] = prompt.id\n    return prompt.id\n'
);

evalContent = evalContent.replace(
  '    prompt = await db.promptversion.find_first(\n        where={"aiModelId": ai_model_id, "versionLabel": version_label}\n    )',
  '    key = (ai_model_id, version_label)\n    if key in _PROMPT_VERSION_CACHE:\n        return _PROMPT_VERSION_CACHE[key]\n    prompt = await db.promptversion.find_first(\n        where={"aiModelId": ai_model_id, "versionLabel": version_label}\n    )'
);

fs.writeFileSync(evalRegistryPath, evalContent, 'utf8');

// 2. ocr/ai_model_registry.py
const ocrRegistryPath = 'apps/api-python/src/ocr/ai_model_registry.py';
let ocrContent = fs.readFileSync(ocrRegistryPath, 'utf8');

const ocrCacheDecl = `_OCR_MODEL_ID_CACHE = {}
_OCR_MODEL_VERSION_CACHE = {}

def clear_ocr_registry_cache():
    _OCR_MODEL_ID_CACHE.clear()
    _OCR_MODEL_VERSION_CACHE.clear()
`;

ocrContent = ocrContent.replace(
  'from src.database import db\n',
  'from src.database import db\n\n' + ocrCacheDecl + '\n'
);

const oldResolveOcrId = `async def resolve_ocr_ai_model_id(provider_name: str = PROVIDER_NAME, model_name: str = MODEL_NAME) -> str:
    provider = await db.aiprovider.find_first(where={"name": provider_name})`;

const newResolveOcrId = `async def resolve_ocr_ai_model_id(provider_name: str = PROVIDER_NAME, model_name: str = MODEL_NAME) -> str:
    key = (provider_name, model_name)
    if key in _OCR_MODEL_ID_CACHE:
        return _OCR_MODEL_ID_CACHE[key]
    provider = await db.aiprovider.find_first(where={"name": provider_name})`;

ocrContent = ocrContent.replace(oldResolveOcrId, newResolveOcrId);

ocrContent = ocrContent.replace(
  '    return model.id\n\n\nasync def resolve_active_ocr_model_version',
  '    _OCR_MODEL_ID_CACHE[key] = model.id\n    return model.id\n\n\nasync def resolve_active_ocr_model_version'
);

ocrContent = ocrContent.replace(
  'async def resolve_active_ocr_model_version(ai_model_id: str, version_label: str = VERSION_LABEL):\n    """Returns the active AIModelVersion row, or None if OCR is deconfigured.',
  'async def resolve_active_ocr_model_version(ai_model_id: str, version_label: str = VERSION_LABEL):\n    key = (ai_model_id, version_label)\n    if key in _OCR_MODEL_VERSION_CACHE:\n        return _OCR_MODEL_VERSION_CACHE[key]\n    """Returns the active AIModelVersion row, or None if OCR is deconfigured.'
);

ocrContent = ocrContent.replace(
  '    if version is not None:\n        return version',
  '    if version is not None:\n        _OCR_MODEL_VERSION_CACHE[key] = version\n        return version'
);

ocrContent = ocrContent.replace(
  '    return await db.aimodelversion.create(\n        data={"aiModelId": ai_model_id, "versionLabel": version_label, "isActive": True}\n    )',
  '    created = await db.aimodelversion.create(\n        data={"aiModelId": ai_model_id, "versionLabel": version_label, "isActive": True}\n    )\n    _OCR_MODEL_VERSION_CACHE[key] = created\n    return created'
);

fs.writeFileSync(ocrRegistryPath, ocrContent, 'utf8');

console.log('Python model registries updated with in-memory caching!');

