import { config } from '../config.js'
import { HttpError } from '../onboarding/workflow.js'
export async function rag(path, body) {
  const res = await fetch(config.ragUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': config.ragSecret,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok)
    throw new HttpError(
      422,
      'Policy processing failed. Check the source and retry.'
    )
  return res.json()
}
export async function retrieve(db, profile, question, purpose = 'answer') {
  const where = {
    approved: true,
    archived: false,
    processing: 'Ready',
    AND: ['job', 'department', 'location'].map((k) => ({
      OR: [{ [k]: null }, { [k]: profile[k] || 'General' }],
    })),
  }
  const documents = await db.policy.findMany({
    where,
    select: {
      id: true,
      title: true,
      version: true,
      body: true,
      chunks: true,
      job: true,
      department: true,
      location: true,
    },
  })
  if (!documents.length) return []
  try {
    const hits = await rag('/retrieve', { question, documents, purpose })
    return hits.flatMap((hit) => {
      const source = documents.find(
        (d) => d.id === hit.id && d.version === hit.version
      )
      if (
        !source ||
        typeof hit.body !== 'string' ||
        !hit.body ||
        !source.body.includes(hit.body)
      )
        return []
      return [
        {
          id: source.id,
          version: source.version,
          title: source.title,
          body: hit.body,
        },
      ]
    })
  } catch {
    const terms =
      question
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter(
          (t) =>
            t.length > 2 &&
            ![
              'what',
              'who',
              'where',
              'when',
              'how',
              'the',
              'are',
              'can',
              'for',
              'our',
              'does',
              'about',
              'with',
              'get',
              'have',
              'much',
              'company',
              'policy',
              'begin',
            ].includes(t)
        ) || []
    if (!terms.length) return []
    const ids = documents.map((d) => d.id)
    return db.$queryRaw`SELECT id,title,left(body,1000) AS body,version FROM "Policy" WHERE id=ANY(${ids}::text[]) AND approved AND NOT archived AND to_tsvector('english',title||' '||body) @@ to_tsquery('english',${terms.join(' | ')}) ORDER BY ts_rank(to_tsvector('english',title||' '||body),to_tsquery('english',${terms.join(' | ')})) DESC LIMIT 4`
  }
}
