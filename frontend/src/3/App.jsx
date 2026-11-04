import { useCallback, useEffect, useMemo, useState } from 'react';
import { request } from './api.js';

const emptyStudent = { studentId: '', name: '', email: '', department: '', section: '', semester: '', contact: '' };
const initials = (n = '') => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'ST';
const tone = (t = '') => [...t].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const icons = {
  overview: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
  students: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 4.7a3.5 3.5 0 0 1 0 6.6',
  departments: 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6',
  plus: 'M12 5v14M5 12h14'
};

function App() {
  const [page, setPage] = useState('overview');
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [view, setView] = useState('grid');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, d] = await Promise.all([request('/api/students'), request('/api/departments')]);
      const extractArray = (res) => {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res?.data?.data)) return res.data.data;
        return [];
      };
      setStudents(extractArray(s));
      setDepartments(extractArray(d));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) setModal(null);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPage('students');
        requestAnimationFrame(() => document.getElementById('student-search')?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving]);

  const counts = useMemo(() => {
    const m = {};
    students.forEach((s) => { const id = s.department?._id; if (id) m[id] = (m[id] || 0) + 1; });
    return m;
  }, [students]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => (!deptFilter || s.department?._id === deptFilter) &&
      (!q || [s.studentId, s.name, s.email, s.department?.name, s.section].join(' ').toLowerCase().includes(q)));
  }, [students, query, deptFilter]);

  const openStudent = (student = null) => setModal({
    type: 'student', student, formError: '',
    values: student ? {
      studentId: student.studentId, name: student.name, email: student.email, department: student.department?._id || '',
      section: student.section, semester: String(student.semester), contact: student.contact || ''
    } : { ...emptyStudent, department: deptFilter || departments[0]?._id || '' }
  });
  const openDepartment = (department = null) => setModal({
    type: 'department', department, formError: '',
    values: { name: department?.name || '', sections: department ? department.sections.join(', ') : '' }
  });
  const setField = (k, v, extra = {}) => setModal((m) => ({ ...m, values: { ...m.values, [k]: v, ...extra } }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { type, student, department, values } = modal;
      if (type === 'student') {
        const path = student ? `/api/students/${encodeURIComponent(student.studentId)}` : '/api/students';
        await request(path, { method: student ? 'PUT' : 'POST', body: JSON.stringify({ ...values, semester: Number(values.semester) }) });
        setNotice(student ? 'Student updated' : 'Student added');
      } else {
        const sections = [...new Set(values.sections.split(',').map((s) => s.trim()).filter(Boolean))];
        await request(department ? `/api/departments/${department._id}` : '/api/departments', {
          method: department ? 'PUT' : 'POST', body: JSON.stringify({ name: values.name, sections })
        });
        setNotice(department ? 'Department updated' : 'Department created');
      }
      setModal(null);
      await loadData();
    } catch (e) {
      setModal((m) => ({ ...m, formError: e.message }));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kind, item) => {
    if (!window.confirm(`Delete ${item.name}? This can't be undone.`)) return;
    try {
      await request(kind === 'student' ? `/api/students/${encodeURIComponent(item.studentId)}` : `/api/departments/${item._id}`, { method: 'DELETE' });
      setNotice(`${item.name} deleted`);
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const sectionsTotal = departments.reduce((n, d) => n + d.sections.length, 0);
  const semesters = [...new Set(students.map((s) => s.semester))].sort((a, b) => a - b);
  const maxCount = Math.max(1, ...Object.values(counts));
  const modalSections = departments.find((d) => d._id === modal?.values?.department)?.sections || [];
  const titles = { overview: 'Overview', students: 'Students', departments: 'Departments' };
  const navigationLabels = { overview: 'Dashboard', students: 'Students', departments: 'Departments' };

  const StudentActions = ({ s }) => (
    <span className="row-acts">
      <button onClick={() => openStudent(s)} aria-label={`Edit ${s.name}`}>Edit</button>
      <button className="del" onClick={() => remove('student', s)} aria-label={`Delete ${s.name}`}>Delete</button>
    </span>
  );

  return (
    <div className="app">
      <aside className="rail">
        <button className="brand" onClick={() => setPage('overview')} aria-label="Student Management System dashboard">
          <span className="mark">S</span>
          <span className="brand-copy"><strong>Student Management System</strong><small>STUDENT PORTAL</small></span>
        </button>
        <nav aria-label="Main">
          {Object.keys(titles).map((key) => (
            <button key={key} className={page === key ? 'on' : ''} aria-label={navigationLabels[key]} aria-current={page === key ? 'page' : undefined}
              onClick={() => { if (key === 'students') { setDeptFilter(''); setQuery(''); } setPage(key); }}>
              <Icon d={icons[key]} /><span className="nav-label">{navigationLabels[key]}</span>
            </button>
          ))}
        </nav>
        <button className="rail-add" aria-label="New student" disabled={!departments.length} onClick={() => openStudent()}><Icon d={icons.plus} /><span className="nav-label">Add student</span></button>
      </aside>

      <div className="stage">
        <header className="head">
          <div><p className="crumb">Student Management System</p><h1>{titles[page]}</h1></div>
          <div className="head-right">
            {page === 'students' && <button className="btn btn-primary" onClick={() => openStudent()} disabled={!departments.length}>Add student</button>}
            {page === 'departments' && <button className="btn btn-primary" onClick={() => openDepartment()}>Add department</button>}
          </div>
        </header>
        {loading && <div className="load" />}
        <main className="body">
          {error && <div className="note bad" role="alert"><span>{error}</span><button onClick={() => setError('')}>Dismiss</button></div>}

          {page === 'overview' && (
            <div className="dashboard">
              <section className="stat-grid" aria-label="Student statistics">
                <article className="stat-card">
                  <span className="stat-icon"><Icon d={icons.students} /></span>
                  <p>Total Students</p><strong>{students.length}</strong><small>Enrolled in the system</small>
                </article>
                <article className="stat-card">
                  <span className="stat-icon"><Icon d={icons.departments} /></span>
                  <p>Total Departments</p><strong>{departments.length}</strong><small>{sectionsTotal} sections available</small>
                </article>
                <article className="stat-card">
                  <span className="stat-icon"><Icon d={icons.overview} /></span>
                  <p>Total Semesters</p><strong>{semesters.length}</strong><small>Currently represented</small>
                </article>
              </section>
              <div className="bento">
                <section className="tile t-dept">
                  <div className="tile-head"><h2>Students per department</h2><button className="text-btn" onClick={() => setPage('departments')}>Manage</button></div>
                  {departments.length ? departments.map((d) => (
                    <div className="meter" key={d._id}><span>{d.name}</span><i><u style={{ width: `${((counts[d._id] || 0) / maxCount) * 100}%` }} /></i><b>{counts[d._id] || 0}</b></div>
                  )) : <Empty title="No departments" text="Departments organise students into sections." action="Create department" onAction={() => openDepartment()} />}
                </section>
                <section className="tile t-recent">
                  <div className="tile-head"><h2>Recently added</h2><button className="text-btn" onClick={() => setPage('students')}>View all</button></div>
                  {students.length ? students.slice(0, 5).map((s) => (
                    <div className="mini" key={s._id}><span className={`av a${tone(s.name)}`}>{initials(s.name)}</span><div><b>{s.name}</b><small>{s.department?.name || 'No department'}</small></div><em>Sem {s.semester}</em></div>
                  )) : <Empty title="No students yet" text="New students will appear here." action="Add a student" onAction={() => openStudent()} disabled={!departments.length} />}
                </section>
              </div>
            </div>
          )}

          {page === 'students' && (<>
            <div className="toolbar">
              <div className="find"><input id="student-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students" aria-label="Search students" /><kbd>Ctrl K</kbd></div>
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Filter by department">
                <option value="">All departments</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
              <div className="seg" role="group" aria-label="Layout">
                <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}>Cards</button>
                <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
              </div>
            </div>
            {!departments.length && <div className="note">Create a department before enrolling students. <button className="text-btn" onClick={() => setPage('departments')}>Go to departments</button></div>}
            {!visible.length ? <Empty title={students.length ? 'No matches' : 'No students yet'} text={students.length ? 'Try another name, ID or department.' : 'Your roster is empty.'} action={students.length ? undefined : 'Add a student'} onAction={() => openStudent()} disabled={!departments.length} />
              : view === 'grid' ? (
                <div className="cards">{visible.map((s) => (
                  <article className="person" key={s._id}>
                    <div className="person-top"><span className={`av big a${tone(s.name)}`}>{initials(s.name)}</span><span className="sid">{s.studentId}</span></div>
                    <h3>{s.name}</h3><small>{s.email}</small>
                    <dl><div><dt>Department</dt><dd>{s.department?.name || '—'}</dd></div><div><dt>Section</dt><dd>{s.section || '—'}</dd></div><div><dt>Semester</dt><dd>{s.semester}</dd></div></dl>
                    <StudentActions s={s} />
                  </article>))}</div>
              ) : (
                <div className="list">
                  <div className="list-head" aria-hidden="true"><span>Student</span><span>Roll number</span><span>Department</span><span>Section</span><span>Semester</span><span>Actions</span></div>
                  {visible.map((s) => (
                  <div className="line" key={s._id}>
                    <span className="student-cell"><span className={`av a${tone(s.name)}`}>{initials(s.name)}</span><span className="grow"><b>{s.name}</b><small>{s.email}</small></span></span>
                    <span className="sid">{s.studentId}</span><span>{s.department?.name || '—'}</span>
                    <span>{s.section || '—'}</span><span>Sem {s.semester}</span><StudentActions s={s} />
                  </div>))}
                </div>
              )}
          </>)}

          {page === 'departments' && (departments.length ? (
            <div className="deps">{departments.map((d) => (
              <article className="dep" key={d._id}>
                <div className="dep-top"><span className={`av sqr a${tone(d.name)}`}>{d.name[0]?.toUpperCase()}</span>
                  <span className="row-acts"><button onClick={() => openDepartment(d)}>Edit</button><button className="del" onClick={() => remove('department', d)}>Delete</button></span></div>
                <h3>{d.name}</h3>
                <p className="muted">{counts[d._id] || 0} {(counts[d._id] || 0) === 1 ? 'student' : 'students'}</p>
                <div className="pills">{d.sections.length ? d.sections.map((s) => <span key={s}>Section {s}</span>) : <small>No sections yet</small>}</div>
              </article>))}</div>
          ) : <Empty title="Build your structure" text="Add a department and its sections to start enrolling." action="Create department" onAction={() => openDepartment()} />)}
        </main>
      </div>

      {notice && <div className="toast" role="status">{notice}</div>}

      {modal && (
        <div className="veil" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setModal(null); }}>
          <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg" onSubmit={submit}>
            <h2 id="dlg">{modal.type === 'student' ? (modal.student ? 'Edit student' : 'Add student') : (modal.department ? 'Edit department' : 'Add department')}</h2>
            {modal.formError && <div className="note bad" role="alert">{modal.formError}</div>}
            <div className="fields">
              {modal.type === 'student' ? (<>
                <label>Roll Number<input required maxLength="30" disabled={Boolean(modal.student)} value={modal.values.studentId} placeholder="ST101" onChange={(e) => setField('studentId', e.target.value)} /></label>
                <label>Full Name<input required maxLength="100" value={modal.values.name} placeholder="Rahul Sharma" onChange={(e) => setField('name', e.target.value)} /></label>
                <label className="full">Email Address<input required type="email" maxLength="254" value={modal.values.email} placeholder="student@college.edu" onChange={(e) => setField('email', e.target.value)} /></label>
                <label>Department<select required value={modal.values.department} onChange={(e) => setField('department', e.target.value, { section: '' })}>
                  <option value="" disabled>Choose</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></label>
                <label>Section<select required={modalSections.length > 0} disabled={!modalSections.length} value={modal.values.section} onChange={(e) => setField('section', e.target.value)}>
                  <option value="" disabled={modalSections.length > 0}>{modalSections.length ? 'Choose' : 'Not needed'}</option>{modalSections.map((s) => <option key={s}>{s}</option>)}</select></label>
                <label>Semester<input required type="number" min="1" max="12" value={modal.values.semester} placeholder="1 to 12" onChange={(e) => setField('semester', e.target.value)} /></label>
                <label>Phone (optional)<input type="tel" maxLength="20" value={modal.values.contact} placeholder="9876543210" onChange={(e) => setField('contact', e.target.value)} /></label>
              </>) : (<>
                <label className="full">Department name<input required maxLength="80" value={modal.values.name} placeholder="Computer Science and Engineering" onChange={(e) => setField('name', e.target.value)} /></label>
                <label className="full">Sections, separated by commas<input maxLength="500" value={modal.values.sections} placeholder="A, B" onChange={(e) => setField('sections', e.target.value)} /><small>Sections that still have students can’t be removed.</small></label>
              </>)}
            </div>
            <div className="dlg-foot">
              <button type="button" className="btn" disabled={saving} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : modal.student || modal.department ? 'Save changes' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Empty({ title, text, action, onAction, disabled }) {
  return <div className="empty"><h3>{title}</h3><p>{text}</p>{action && <button className="btn" onClick={onAction} disabled={disabled}>{action}</button>}</div>;
}

export default App;
