import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import useAuth from '../hooks/useAuth';
import ProfileMenu from "../components/ProfileMenu";
import { touchBoard } from '../lib/boards';


function BoardMenu({ board, onDelete, onRename }) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(board.name);
  const menuRef = useRef(null);


  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setRenaming(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleRename() {
    if (!newName.trim() || newName === board.name) { setRenaming(false); return; }
    await supabase.from('boards').update({ name: newName.trim() }).eq('id', board.id);
    onRename(newName.trim());
    setRenaming(false);
    setOpen(false);
  }

  return (
    <div className="board-menu" ref={menuRef} onClick={e => e.stopPropagation()}>
      <button className="board-menu-btn" onClick={() => {
        setOpen(prev => {
          if (prev) setRenaming(false);
          return !prev;
        });
      }}>···</button>
      {open && (
        <div className="board-menu-dropdown">
          {renaming ? (
            <div className="board-rename-row">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRename()}
              />
              <button onClick={handleRename}>Save</button>
            </div>
          ) : (
            <>
              <button onClick={() => setRenaming(true)}>Rename board</button>
              <button className="delete-option" onClick={() => { onDelete(); setOpen(false); }}>Delete board</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PinMenu({ itemId, currentBoardId, onDelete, onMove, onMoveToNew }) {
  const [open, setOpen] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [boards, setBoards] = useState([]);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    supabase.from('boards').select('*').order('created_at', { ascending: true }).then(({ data }) => setBoards(data || []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setShowMove(false);
        setNewBoardName('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleCreateAndMove() {
    if (!newBoardName.trim()) return;
    await onMoveToNew(itemId, newBoardName.trim());
    setOpen(false);
    setShowMove(false);
    setNewBoardName('');
  }

  return (
    <div className="pin-menu" ref={menuRef}>
      <button className="pin-menu-btn" onClick={() => { setOpen(prev => !prev); setShowMove(false); }}>···</button>
      {open && !showMove && (
        <div className="board-menu-dropdown">
          <button onClick={() => setShowMove(true)}>Move item</button>
          <button className="delete-option" onClick={() => { onDelete(itemId); setOpen(false); }}>Unsave item</button>
        </div>
      )}
      {open && showMove && (
        <div className="board-picker">
          {boards.filter(b => b.id !== currentBoardId).map(b => (
            <button key={b.id} onClick={() => { onMove(itemId, b.id); setOpen(false); setShowMove(false); }}>
              {b.name}
            </button>
          ))}
          <input
            value={newBoardName}
            onChange={e => setNewBoardName(e.target.value)}
            placeholder="New board name"
            onKeyDown={e => e.key === 'Enter' && handleCreateAndMove()}
          />
          <button className="create-save-btn" onClick={handleCreateAndMove}>Create & Move</button>

        </div>
      )}
    </div>
  );
}

function BoardPage() {
  const session = useAuth();
  const navigate = useNavigate();
  const { boardId } = useParams();
  const { state } = useLocation();
  const [board, setBoard] = useState(state?.name ? { name: state.name } : null);
  const [items, setItems] = useState(state?.items || []);
  const [loading, setLoading] = useState(!state?.items);

  useEffect(() => {
    if (!session) return;
    fetchBoard();
    if (!state?.items) fetchItems();
  }, [session, boardId]);

  async function fetchBoard() {
    const { data } = await supabase.from('boards').select('*').eq('id', boardId).single();
    setBoard(data);
  }

  async function fetchItems() {
    const { data } = await supabase
      .from('saved_items')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  async function deleteItem(itemId) {
    await supabase.from('saved_items').delete().eq('id', itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  }

  async function moveItem(itemId, newBoardId) {
    await supabase.from('saved_items').update({ board_id: newBoardId }).eq('id', itemId);
    await touchBoard(newBoardId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  }

  async function moveToNewBoard(itemId, boardName) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('boards')
      .insert({ user_id: user.id, name: boardName })
      .select();
    if (data) {
      await supabase.from('saved_items').update({ board_id: data[0].id }).eq('id', itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
    }
  }

  async function handleDelete() {
    const { error } = await supabase.from('boards').delete().eq('id', boardId);
    if (error) {
      console.error(error);
      return;
    }
    navigate('/boards');
  }

  function handleRename(newName) {
    setBoard(prev => ({ ...prev, name: newName }));
  }

  if (!session) return (
    <div className="boards-empty">
      <p>Please log in to view your boards.</p>
      <button onClick={() => navigate('/')}>Go Home</button>
    </div>
  );

  return (
    <>
      <div className="app-header-wrap">
        <div className="app-header">
          <span className="logo-link" onClick={() => navigate('/', { replace: true })}>Rent the Look</span>
          <ProfileMenu session={session} />
        </div>
      </div>
      <div className="boards-page">
        <div className="boards-header">
          <h1>{board?.name || 'Board'}</h1>
          {board && (
            <BoardMenu
              board={board}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          )}
        </div>

        {items.length === 0 ? (
          <p className="select-prompt">No items saved to this board yet.</p>
        ) : (
          <div className="saved-items-grid">
            {items.map(item => {
              const d = item.item_data;
              return (
                <div key={item.id} className="saved-item-card">
                  <div className="pin-menu-wrapper">
                    <PinMenu
                      itemId={item.id}
                      currentBoardId={boardId}
                      onDelete={deleteItem}
                      onMove={moveItem}
                      onMoveToNew={moveToNewBoard}
                    />
                  </div>
                  {d.image ? <img src={d.image} alt={d.name} /> : <div className="saved-item-no-image">{d.site}</div>}
                  <div className="saved-item-site">{d.site}</div>
                  <div className="saved-item-name">{d.name}</div>
                  {d.size && <div className="saved-item-meta">Size: {d.size}</div>}
                  {d.availableSizes?.length > 0 && (
                    <div className="saved-item-meta">Sizes: {d.availableSizes.join(', ')}</div>
                  )}
                  {d.sizesNote && !d.availableSizes?.length && (
                    <div className="saved-item-meta">{d.sizesNote}</div>
                  )}
                  {d.rentPrice && (
                    <div className="saved-item-price">
                      ${d.rentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span>/{d.period === 'month (for 6 items)' ? 'month' : 'week'}</span>
                      {d.retailPrice > 0 && (
                        <span className="savings"> · save ${(d.retailPrice - d.rentPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                    </div>
                  )}
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="view-link">
                    View on {d.site} →
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default BoardPage;