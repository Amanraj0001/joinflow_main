export function evidenceFor(task, profile) {
  if (task.completionMethod === 'Evidence')
    return profile.documents.find((doc) => doc.kind === task.evidenceKind)
}
