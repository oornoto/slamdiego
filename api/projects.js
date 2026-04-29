import { getServiceClient, verifyUser, setSecurityHeaders } from './_lib.js';

export default async function handler(req, res) {
  setSecurityHeaders(res);

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getServiceClient();

  if (req.method === 'GET') {
    // Fetch all sections with their projects and services
    const { data: sections, error: secErr } = await supabase
      .from('sections')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order');

    if (secErr) return res.status(500).json({ error: 'Failed to fetch sections' });

    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('display_order');

    if (projErr) return res.status(500).json({ error: 'Failed to fetch projects' });

    const projectIds = projects.map(p => p.id);
    let services = [];
    if (projectIds.length > 0) {
      const { data: svcData, error: svcErr } = await supabase
        .from('services')
        .select('*')
        .in('project_id', projectIds)
        .order('display_order');
      if (svcErr) return res.status(500).json({ error: 'Failed to fetch services' });
      services = svcData;
    }

    // Assemble nested structure
    const result = sections.map(section => ({
      ...section,
      projects: projects
        .filter(p => p.section_id === section.id)
        .map(project => ({
          ...project,
          services: services.filter(s => s.project_id === project.id)
        }))
    }));

    return res.status(200).json(result);
  }

  if (req.method === 'POST') {
    const { section_id, name, description, url, services, display_order } = req.body;

    if (!section_id || !name || !url) {
      return res.status(400).json({ error: 'section_id, name, and url are required' });
    }

    // Verify section belongs to this user
    const { data: section } = await supabase
      .from('sections')
      .select('id')
      .eq('id', section_id)
      .eq('user_id', user.id)
      .single();

    if (!section) return res.status(403).json({ error: 'Section not found' });

    // Insert project
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({ user_id: user.id, section_id, name, description, url, display_order: display_order || 0 })
      .select()
      .single();

    if (projErr) return res.status(500).json({ error: 'Failed to create project' });

    // Insert services
    if (services && services.length > 0) {
      const svcRows = services.map((s, i) => ({
        project_id: project.id,
        name: s.name,
        url: s.url,
        display_order: i
      }));
      await supabase.from('services').insert(svcRows);
    }

    return res.status(201).json(project);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
