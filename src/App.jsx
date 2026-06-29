import { useState, useCallback } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { getWeekStart, formatDate, addWeeks } from './utils/dates';
import WeekView from './components/WeekView';
import Settings from './components/Settings';
import ShiftForm from './components/ShiftForm';
import NavBar from './components/NavBar';

const DEFAULT_SETTINGS = {
  hourlyRate: 0,
  expectedWeeklyHours: 40,
};

export default function App() {
  const [shifts, setShifts] = useLocalStorage('turni_shifts', {});
  const [settings, setSettings] = useLocalStorage('turni_settings', DEFAULT_SETTINGS);
  const [view, setView] = useState('week');
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()));
  const [modal, setModal] = useState(null); // null | {type:'add',date} | {type:'edit',shift}

  const addShift = useCallback((shiftData) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setShifts(prev => ({ ...prev, [id]: { ...shiftData, id } }));
  }, [setShifts]);

  const updateShift = useCallback((shift) => {
    setShifts(prev => ({ ...prev, [shift.id]: shift }));
  }, [setShifts]);

  const deleteShift = useCallback((id) => {
    setShifts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [setShifts]);

  const weekShifts = useCallback((weekStart) => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return formatDate(d);
    });
    return Object.values(shifts).filter(s => days.includes(s.date));
  }, [shifts]);

  const handleSaveShift = useCallback((shiftData) => {
    if (modal?.type === 'add') addShift(shiftData);
    else updateShift(shiftData);
    setModal(null);
  }, [modal, addShift, updateShift]);

  return (
    <div className="app">
      <NavBar view={view} onNavigate={setView} />

      <main className="main-content">
        {view === 'week' && (
          <WeekView
            currentWeek={currentWeek}
            onWeekChange={setCurrentWeek}
            onWeekPrev={() => setCurrentWeek(w => addWeeks(w, -1))}
            onWeekNext={() => setCurrentWeek(w => addWeeks(w, 1))}
            onWeekReset={() => setCurrentWeek(getWeekStart(new Date()))}
            shifts={weekShifts(currentWeek)}
            onAddShift={(date) => setModal({ type: 'add', date })}
            onEditShift={(shift) => setModal({ type: 'edit', shift })}
            onDeleteShift={deleteShift}
            settings={settings}
          />
        )}

        {view === 'settings' && (
          <Settings settings={settings} onSave={setSettings} />
        )}
      </main>

      {modal && (
        <ShiftForm
          modal={modal}
          onSave={handleSaveShift}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
