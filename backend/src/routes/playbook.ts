import { Router, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../services/supabase';
import { AuthenticatedRequest } from '../types/index';

const router = Router();

// GET /
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('playbook_entries')
      .select('*')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { setup_name, description, rules, ideal_conditions, screenshot_url } = req.body;

    const { data, error } = await supabase
      .from('playbook_entries')
      .insert({
        user_id: req.userId!,
        setup_name,
        description: description || '',
        rules: rules || '',
        ideal_conditions: ideal_conditions || '',
        screenshot_url: screenshot_url || '',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /:id
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('playbook_entries')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    if (existing.user_id !== req.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { data, error } = await supabase
      .from('playbook_entries')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('playbook_entries')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    if (existing.user_id !== req.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { error } = await supabase
      .from('playbook_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
