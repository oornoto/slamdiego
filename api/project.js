import { getDashboardClient, verifyUser, setSecurityHeaders } from './_lib.js';

export default async function handler(req, res) {
  setSecurityHeaders(res);

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Project ID required' });

  const supabase = getDashboardClient();

  // Verify project belongs to this user
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Project not found' });

  if (req.method === 'PUT') {
    const { name, description, url, section_id, display_order, services } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'name and url are required' });
    }

    // Update project
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .update({ name, description, url, section_id, display_order })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (projErr) return res.status(500).json({ error: 'Failed to update project' });

    // Replace services — delete existing and re-insert
    await supabase.from('services').delete().eq('project_id', id);

    if (services && services.length > 0) {
      const svcRows = services.map((s, i) => ({
        project_id: id,
        name: s.name,
        url: s.url,
        display_order: i
      }));
      await supabase.from('services').insert(svcRows);
    }

    return res.status(200).json(project);
  }

  if (req.method === 'DELETE') {
    // Services cascade delete via foreign key
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ error: 'Failed to delete project' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
