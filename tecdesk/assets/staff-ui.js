(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const select=$('staffSelect');
  const selectMode=$('staffSelectMode');
  const manualMode=$('staffManualMode');
  const manualName=$('otherStaffName');
  const manualType=$('otherStaffType');
  const back=$('backToStaffList');
  const requesterName=$('requesterName');
  const requesterEmail=$('requesterEmail');
  const requesterAssignment=$('requesterAssignment');
  const requesterSchedule=$('requesterSchedule');
  const requesterGrade=$('requesterGrade');
  const department=$('department');
  const profile=$('selectedStaffInfo');

  if(!select) return;

  const OTHER_DEPT={
    'Asistente administrativo/a':'Administración / Personal escolar',
    'Secretaría / Oficina':'Administración / Personal escolar',
    'Asistente de Educación Especial':'Educación Especial',
    'Comedor Escolar':'Comedor Escolar',
    'Mantenimiento / Custodia':'Mantenimiento / Custodia',
    'Seguridad':'Seguridad',
    'Administración':'Administración / Personal escolar'
  };

  function setDepartment(value){
    if(!department) return;
    const exists=[...department.options].some(o=>o.value===value);
    if(exists){
      department.value=value;
      department.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }

  function clearPersonFields(){
    if(requesterName) requesterName.value='';
    if(requesterEmail) requesterEmail.value='';
    if(requesterAssignment) requesterAssignment.value='';
    if(requesterSchedule) requesterSchedule.value='';
    if(requesterGrade) requesterGrade.value='';
    profile?.classList.add('hidden');
  }

  function fillProfile(option){
    const d=option.dataset;
    requesterName.value=d.name||'';
    requesterEmail.value=d.email||'';
    requesterAssignment.value=d.assignment||'';
    requesterSchedule.value=d.schedule||'';
    requesterGrade.value=d.grade||'';
    setDepartment(d.department||'');
    $('staffInfoName').textContent=d.name||'—';
    $('staffInfoEmail').textContent=d.email||'—';
    $('staffInfoAssignment').textContent=d.assignment||'—';
    $('staffInfoSchedule').textContent=d.schedule||'—';
    $('staffInfoGrade').textContent=d.grade||'—';
    profile?.classList.remove('hidden');
  }

  function enterManualMode(){
    clearPersonFields();
    selectMode?.classList.add('hidden');
    manualMode?.classList.remove('hidden');
    if(manualName){ manualName.required=true; manualName.value=''; }
    if(manualType){ manualType.required=true; manualType.value=''; }
    if(department) department.value='';
    setTimeout(()=>manualName?.focus(),0);
  }

  function leaveManualMode(){
    if(manualName){ manualName.required=false; manualName.value=''; }
    if(manualType){ manualType.required=false; manualType.value=''; }
    manualMode?.classList.add('hidden');
    selectMode?.classList.remove('hidden');
    select.value='';
    clearPersonFields();
    if(department) department.value='';
    setTimeout(()=>select.focus(),0);
  }

  function onSelect(){
    const option=select.options[select.selectedIndex];
    if(!select.value){ clearPersonFields(); return; }
    if(select.value==='__other_staff'){ enterManualMode(); return; }
    fillProfile(option);
  }

  select.addEventListener('change',onSelect);
  back?.addEventListener('click',leaveManualMode);
  manualName?.addEventListener('input',()=>{ if(requesterName) requesterName.value=manualName.value.trim(); });
  manualType?.addEventListener('change',()=>{
    const inferred=OTHER_DEPT[manualType.value];
    if(inferred) setDepartment(inferred);
    if(requesterAssignment) requesterAssignment.value=manualType.value||'Otro personal escolar';
  });

  window.PCBStaffUI={
    reset(){
      if(manualName){ manualName.required=false; manualName.value=''; }
      if(manualType){ manualType.required=false; manualType.value=''; }
      manualMode?.classList.add('hidden');
      selectMode?.classList.remove('hidden');
      select.value='';
      clearPersonFields();
    }
  };
})();
