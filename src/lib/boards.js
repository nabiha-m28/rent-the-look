import { supabase } from './supabase';

export async function touchBoard(boardId) {
  await supabase.from('boards').update({ last_added_at: new Date().toISOString() }).eq('id', boardId);
}

async function getBoards() {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .order('created_at', { ascending: true });
  return data;
}

async function createBoard(name) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('boards')
    .insert({ user_id: user.id, name })
    .select();
  return data;
}

async function saveItem(boardId, itemData) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('saved_items')
    .insert({ board_id: boardId, user_id: user.id, item_data: itemData })
    .select();
  return data;
}

async function getBoardItems(boardId) {
  const { data, error } = await supabase
    .from('saved_items')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false });
  return data;
}

async function deleteItem(itemId) {
  await supabase.from('saved_items').delete().eq('id', itemId);
}