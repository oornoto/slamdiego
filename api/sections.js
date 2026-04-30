import { getDashboardClient, verifyUser, setSecurityHeaders } from './_lib.js';

export default async function handler(req, res) {
  setSecurityHeaders(res);

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getDashboardClient();

  if (req.method === 'POST') {
    const { name, display_order } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabase
      .from('sections')
      .insert({ user_id: user.id, name, display_order: display_order || 0 })
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to create section' });
    return res.status(201).json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Section ID required' });

    // Projects and services cascade delete via foreign keys
    const { error } = await supabase
      .from('sections')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ error: 'Failed to delete section' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
