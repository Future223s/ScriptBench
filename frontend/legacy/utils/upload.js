const SUPPORTED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "tif", "tiff", "webp"]);

export function getFileExtension(fileName) {
  return fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "";
}

function normalizeRelativePath(relativePath) {
  return String(relativePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function splitRelativePath(relativePath) {
  return normalizeRelativePath(relativePath).split("/").filter(Boolean);
}

function dropFolderRoot(relativePath) {
  const parts = splitRelativePath(relativePath);
  if (parts.length <= 1) {
    return parts.join("/");
  }
  return parts.slice(1).join("/");
}

function commonDirectoryPrefix(relativePaths) {
  const directories = relativePaths
    .map((relativePath) => splitRelativePath(relativePath).slice(0, -1))
    .filter((parts) => parts.length);

  if (directories.length <= 1) {
    return "";
  }

  let prefix = directories[0];
  for (let index = 1; index < directories.length; index += 1) {
    const current = directories[index];
    let sharedLength = 0;
    while (
      sharedLength < prefix.length
      && sharedLength < current.length
      && prefix[sharedLength] === current[sharedLength]
    ) {
      sharedLength += 1;
    }
    prefix = prefix.slice(0, sharedLength);
    if (!prefix.length) {
      break;
    }
  }

  return prefix.join("/");
}

function stripCommonRoot(relativePath, commonRoot, { preserveFullPathWhenNoCommonRoot = false } = {}) {
  if (!commonRoot) {
    return preserveFullPathWhenNoCommonRoot ? normalizeRelativePath(relativePath) : dropFolderRoot(relativePath);
  }

  const normalized = normalizeRelativePath(relativePath);
  const rootPrefix = `${commonRoot}/`;
  if (normalized.startsWith(rootPrefix)) {
    return normalized.slice(rootPrefix.length);
  }
  return dropFolderRoot(relativePath);
}

function stripExtension(relativePath) {
  return relativePath.replace(/\.[^./]+$/, "");
}

function stripGroundTruthSuffix(relativePath) {
  const parts = splitRelativePath(relativePath);
  if (!parts.length) {
    return relativePath;
  }

  const lastPart = parts.pop().replace(/_gt$/i, "");
  parts.push(lastPart);
  return parts.join("/");
}

function relativePathToSampleId(relativePath) {
  return relativePath
    .split("/")
    .filter(Boolean)
    .join("__");
}

export function normalizeFolderSampleId(relativePath) {
  return relativePathToSampleId(stripExtension(dropFolderRoot(relativePath)));
}

export function normalizeFolderSampleIdWithRoot(relativePath, commonRoot = "", { preserveFullPathWhenNoCommonRoot = false } = {}) {
  return relativePathToSampleId(
    stripExtension(
      stripCommonRoot(relativePath, commonRoot, { preserveFullPathWhenNoCommonRoot }),
    ),
  );
}

export function normalizeGroundTruthFolderSampleId(relativePath) {
  return relativePathToSampleId(
    stripGroundTruthSuffix(stripExtension(dropFolderRoot(relativePath))),
  );
}

export function normalizeGroundTruthFolderSampleIdWithRoot(relativePath, commonRoot = "", { preserveFullPathWhenNoCommonRoot = false } = {}) {
  return relativePathToSampleId(
    stripGroundTruthSuffix(
      stripExtension(
        stripCommonRoot(relativePath, commonRoot, { preserveFullPathWhenNoCommonRoot }),
      ),
    ),
  );
}

export function isSupportedImageFile(file) {
  const mimeType = String(file?.type || "").toLowerCase();
  if (mimeType.startsWith("image/")) return true;
  return SUPPORTED_IMAGE_EXTENSIONS.has(getFileExtension(String(file?.name || "")));
}

export function collectImageFolderFiles(files) {
  const imageFiles = files.filter((file) => isSupportedImageFile(file));
  const commonRoot = commonDirectoryPrefix(
    imageFiles.map((file) => file.webkitRelativePath || file.name),
  );
  const preserveFullPathWhenNoCommonRoot = !commonRoot && imageFiles.length > 1;

  return imageFiles.map((file) => ({
    file,
    sampleId: normalizeFolderSampleIdWithRoot(file.webkitRelativePath || file.name, commonRoot, {
      preserveFullPathWhenNoCommonRoot,
    }),
  }));
}

export async function collectGroundTruthFolderFiles(files) {
  const texts = new Map();
  const textFiles = files.filter((file) => getFileExtension(file.name) === "txt");
  const commonRoot = commonDirectoryPrefix(
    textFiles.map((file) => file.webkitRelativePath || file.name),
  );
  const preserveFullPathWhenNoCommonRoot = !commonRoot && textFiles.length > 1;

  for (const file of textFiles) {
    const relativePath = file.webkitRelativePath || file.name;
    const sampleId = normalizeGroundTruthFolderSampleIdWithRoot(relativePath, commonRoot, {
      preserveFullPathWhenNoCommonRoot,
    });
    texts.set(sampleId, await file.text());
  }

  return texts;
}
