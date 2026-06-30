import { useState, useCallback } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { formatDate, getMonthStart } from './utils/dates';
import CalendarView from './components/CalendarView';
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
  const [view, setView] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState(() => getMonthStart(new Date()));
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

  const monthShifts = useCallback((monthDate) => {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    return Object.values(shifts).filter(s => {
      const d = new Date(s.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [shifts]);

  const importShifts = useCallback((parsedShifts) => {
    setShifts(prev => {
      const next = { ...prev };
      parsedShifts.forEach(shiftData => {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        next[id] = { ...shiftData, id, breakMinutes: shiftData.breakMinutes || 0, note: shiftData.note || '' };
      });
      return next;
    });
  }, [setShifts]);

  const handleSaveShift = useCallback((shiftData) => {
    if (modal?.type === 'add') addShift(shiftData);
    else updateShift(shiftData);
    setModal(null);
  }, [modal, addShift, updateShift]);

  return (
    <div className="app">
      <NavBar view={view} onNavigate={setView} />

      <main className="main-content">
        {view === 'calendar' && (
          <CalendarView
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            shifts={monthShifts(currentMonth)}
            onAddShift={(date) => setModal({ type: 'add', date })}
            onEditShift={(shift) => setModal({ type: 'edit', shift })}
            onDeleteShift={deleteShift}
            onImportShifts={importShifts}
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
