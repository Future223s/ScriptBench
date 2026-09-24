function lcsOperations(before, after) {
  const rows = before.length + 1;
  const columns = after.length + 1;
  const lengths = Array.from({ length: rows }, () => new Uint32Array(columns));

  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      lengths[left][right] = before[left] === after[right]
        ? lengths[left + 1][right + 1] + 1
        : Math.max(lengths[left + 1][right], lengths[left][right + 1]);
    }
  }

  const operations = [];
  let left = 0;
  let right = 0;
  while (left < before.length || right < after.length) {
    if (left < before.length && right < after.length && before[left] === after[right]) {
      operations.push({ type: "equal", text: before[left] });
      left += 1;
      right += 1;
    } else if (right < after.length && (left === before.length || lengths[left][right + 1] > lengths[left + 1][right])) {
      operations.push({ type: "insert", text: after[right] });
      right += 1;
    } else {
      operations.push({ type: "delete", text: before[left] });
      left += 1;
    }
  }
  return operations;
}

function mergeOperations(operations) {
  return operations.reduce((merged, operation) => {
    const previous = merged.at(-1);
    if (previous?.type === operation.type) previous.text += operation.text;
    else merged.push({ ...operation });
    return merged;
  }, []);
}

export function buildCharacterDiff(before, after) {
  return mergeOperations(lcsOperations(Array.from(before), Array.from(after)));
}
