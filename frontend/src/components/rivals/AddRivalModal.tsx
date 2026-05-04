import { useState } from 'react';

interface AddRivalModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (username: string) => void;
}

export default function AddRivalModal({ open, onClose, onSubmit }: AddRivalModalProps) {
  const [username, setUsername] = useState('');
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const submit = () => {
    const cleaned = username.trim().replace(/^@/, '');
    if (!cleaned) return;
    onSubmit(cleaned);
    setSent(true);
    window.setTimeout(() => {
      setSent(false);
      setUsername('');
      onClose();
    }, 900);
  };

  return (
    <div className="rv-modal-wrap" onClick={onClose}>
      <div className="rv-modal-backdrop" />
      <div className="rv-modal" onClick={event => event.stopPropagation()}>
        <div className="rv-section-kicker">Rivals</div>
        <h3>Challenge someone</h3>
        <p>Enter their Flyxa username. They will receive a rival request.</p>
        <input
          value={username}
          placeholder="@username"
          onChange={event => setUsername(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') submit();
          }}
        />
        <button type="button" disabled={!username.trim() || sent} onClick={submit}>
          {sent ? 'Request sent' : 'Send request'}
        </button>
      </div>
    </div>
  );
}
