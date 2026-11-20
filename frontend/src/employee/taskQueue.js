export function evidenceFor(task, profile) {
  if (task.completionMethod === 'Evidence')
    return profile.documents.find((doc) => doc.kind === task.evidenceKind)
}

export function taskGroup(task, profile) {
  if (task.status === 'Complete') return 'Completed tasks'
  if (task.status === 'Blocked') return 'Blocked'
  const evidence = evidenceFor(task, profile)
  if (evidence && ['Uploaded', 'Processing', 'Pending Review', 'Needs HR Review'].includes(evidence.status))
    return 'Waiting for review'
  if (task.owner.id !== profile.userId || task.approval) return 'Assigned to others'
  return 'Your actions'
}
