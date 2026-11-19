import { getCollection } from 'astro:content';

export async function articlePaths(section: 'photolog' | 'buildlog') {
  const articles = await getCollection('posts', ({data}) => data.section === section && !data.draft);
  const studioPosts = await getCollection('photoPosts', ({data}) => data.section === section);
  const posts = [...articles, ...studioPosts];
  if (new Set(posts.map(post => post.id)).size !== posts.length) throw new Error('Duplicate post URL in ' + section);
  return posts.map(post => ({ params: { slug: post.id }, props: { post } }));
}
