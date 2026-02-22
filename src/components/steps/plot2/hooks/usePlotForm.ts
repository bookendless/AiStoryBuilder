import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PlotFormData, PlotStructureType } from '../types';
import type { Project } from '../../../../contexts/ProjectContext';
import { useAutoSave } from '../../../common/hooks/useAutoSave';

interface UsePlotFormProps {
  currentProject: Project | null;
  updateProject: (updates: Partial<Project>, immediate?: boolean) => Promise<void>;
}

interface UsePlotFormReturn {
  formData: PlotFormData;
  setFormData: React.Dispatch<React.SetStateAction<PlotFormData>>;
  plotStructure: PlotStructureType;
  setPlotStructure: React.Dispatch<React.SetStateAction<PlotStructureType>>;
  isSaving: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  resetFormData: (structure?: PlotStructureType) => void;
}

export function usePlotForm({
  currentProject,
  updateProject,
}: UsePlotFormProps): UsePlotFormReturn {
  const [plotStructure, setPlotStructure] = useState<PlotStructureType>(
    currentProject?.plot?.structure || 'kishotenketsu'
  );

  const [formData, setFormData] = useState<PlotFormData>({
    ki: currentProject?.plot?.ki || '',
    sho: currentProject?.plot?.sho || '',
    ten: currentProject?.plot?.ten || '',
    ketsu: currentProject?.plot?.ketsu || '',
    act1: currentProject?.plot?.act1 || '',
    act2: currentProject?.plot?.act2 || '',
    act3: currentProject?.plot?.act3 || '',
    fourAct1: currentProject?.plot?.fourAct1 || '',
    fourAct2: currentProject?.plot?.fourAct2 || '',
    fourAct3: currentProject?.plot?.fourAct3 || '',
    fourAct4: currentProject?.plot?.fourAct4 || '',
    // ヒーローズ・ジャーニー
    hj1: currentProject?.plot?.hj1 || '',
    hj2: currentProject?.plot?.hj2 || '',
    hj3: currentProject?.plot?.hj3 || '',
    hj4: currentProject?.plot?.hj4 || '',
    hj5: currentProject?.plot?.hj5 || '',
    hj6: currentProject?.plot?.hj6 || '',
    hj7: currentProject?.plot?.hj7 || '',
    hj8: currentProject?.plot?.hj8 || '',
    // ビートシート
    bs1: currentProject?.plot?.bs1 || '',
    bs2: currentProject?.plot?.bs2 || '',
    bs3: currentProject?.plot?.bs3 || '',
    bs4: currentProject?.plot?.bs4 || '',
    bs5: currentProject?.plot?.bs5 || '',
    bs6: currentProject?.plot?.bs6 || '',
    bs7: currentProject?.plot?.bs7 || '',
    // ミステリー・サスペンス
    ms1: currentProject?.plot?.ms1 || '',
    ms2: currentProject?.plot?.ms2 || '',
    ms3: currentProject?.plot?.ms3 || '',
    ms4: currentProject?.plot?.ms4 || '',
    ms5: currentProject?.plot?.ms5 || '',
    ms6: currentProject?.plot?.ms6 || '',
    ms7: currentProject?.plot?.ms7 || '',
  });

  // 自動保存用の統合データ
  const saveData = useMemo(() => ({
    formData,
    plotStructure,
  }), [formData, plotStructure]);

  // 自動保存
  const { isSaving, saveStatus, lastSaved } = useAutoSave(
    saveData,
    async (value: typeof saveData) => {
      if (!currentProject) return;
      const updatedPlot = {
        ...currentProject.plot,
        structure: value.plotStructure,
      };

      if (value.plotStructure === 'kishotenketsu') {
        updatedPlot.ki = value.formData.ki;
        updatedPlot.sho = value.formData.sho;
        updatedPlot.ten = value.formData.ten;
        updatedPlot.ketsu = value.formData.ketsu;
      } else if (value.plotStructure === 'three-act') {
        updatedPlot.act1 = value.formData.act1;
        updatedPlot.act2 = value.formData.act2;
        updatedPlot.act3 = value.formData.act3;
      } else if (value.plotStructure === 'four-act') {
        updatedPlot.fourAct1 = value.formData.fourAct1;
        updatedPlot.fourAct2 = value.formData.fourAct2;
        updatedPlot.fourAct3 = value.formData.fourAct3;
        updatedPlot.fourAct4 = value.formData.fourAct4;
      } else if (value.plotStructure === 'heroes-journey') {
        updatedPlot.hj1 = value.formData.hj1;
        updatedPlot.hj2 = value.formData.hj2;
        updatedPlot.hj3 = value.formData.hj3;
        updatedPlot.hj4 = value.formData.hj4;
        updatedPlot.hj5 = value.formData.hj5;
        updatedPlot.hj6 = value.formData.hj6;
        updatedPlot.hj7 = value.formData.hj7;
        updatedPlot.hj8 = value.formData.hj8;
      } else if (value.plotStructure === 'beat-sheet') {
        updatedPlot.bs1 = value.formData.bs1;
        updatedPlot.bs2 = value.formData.bs2;
        updatedPlot.bs3 = value.formData.bs3;
        updatedPlot.bs4 = value.formData.bs4;
        updatedPlot.bs5 = value.formData.bs5;
        updatedPlot.bs6 = value.formData.bs6;
        updatedPlot.bs7 = value.formData.bs7;
      } else if (value.plotStructure === 'mystery-suspense') {
        updatedPlot.ms1 = value.formData.ms1;
        updatedPlot.ms2 = value.formData.ms2;
        updatedPlot.ms3 = value.formData.ms3;
        updatedPlot.ms4 = value.formData.ms4;
        updatedPlot.ms5 = value.formData.ms5;
        updatedPlot.ms6 = value.formData.ms6;
        updatedPlot.ms7 = value.formData.ms7;
      }

      await updateProject({ plot: updatedPlot }, false);
    }
  );

  // プロジェクトIDを追跡するref
  const previousProjectIdRef = useRef<string | undefined>(undefined);

  // plotStructureの最新値を追跡するref（関数型更新に対応するため）
  const plotStructureRef = useRef<PlotStructureType>(plotStructure);
  useEffect(() => {
    plotStructureRef.current = plotStructure;
  }, [plotStructure]);

  // 構成変更の保護タイマー（ユーザーがドロップダウンで変更した後、一定時間は外部からの上書きを防ぐ）
  const structureChangeProtectionRef = useRef<boolean>(false);
  const structureChangeTimeoutRef = useRef<number | null>(null);

  // 構成が変更されたときに保護を開始し、即座にcurrentProjectに反映
  const handleSetPlotStructure: React.Dispatch<React.SetStateAction<PlotStructureType>> = useCallback((action) => {
    // 既存のタイムアウトをクリア
    if (structureChangeTimeoutRef.current) {
      clearTimeout(structureChangeTimeoutRef.current);
    }

    // 保護を有効化
    structureChangeProtectionRef.current = true;

    // 3秒後に保護を解除（自動保存の遅延2秒 + バッファ1秒）
    structureChangeTimeoutRef.current = setTimeout(() => {
      structureChangeProtectionRef.current = false;
      structureChangeTimeoutRef.current = null;
    }, 3000) as unknown as number;

    // 新しい構成タイプを算出
    const newStructure = typeof action === 'function'
      ? (action as (prev: PlotStructureType) => PlotStructureType)(plotStructureRef.current)
      : action;

    // 実際の状態更新
    setPlotStructure(newStructure);

    // 構成タイプの変更を即座にcurrentProjectに反映
    // AssistantPanelがcurrentProject?.plot?.structureを参照するため、
    // デバウンスを待たずに即時保存してタイムラグを解消する
    if (currentProject) {
      updateProject({
        plot: {
          ...currentProject.plot,
          structure: newStructure,
        }
      }, true);
    }
  }, [currentProject, updateProject]);

  // プロジェクトが変更されたときにformDataを更新
  // formDataの内容フィールドは常に同期するが、構成は保護期間中は上書きしない
  useEffect(() => {
    if (!currentProject) return;

    const isNewProject = previousProjectIdRef.current !== currentProject.id;

    if (isNewProject) {
      previousProjectIdRef.current = currentProject.id;
    }

    // formDataは常にcurrentProjectから同期（AI生成結果を反映するため）
    setFormData({
      ki: currentProject.plot?.ki || '',
      sho: currentProject.plot?.sho || '',
      ten: currentProject.plot?.ten || '',
      ketsu: currentProject.plot?.ketsu || '',
      act1: currentProject.plot?.act1 || '',
      act2: currentProject.plot?.act2 || '',
      act3: currentProject.plot?.act3 || '',
      fourAct1: currentProject.plot?.fourAct1 || '',
      fourAct2: currentProject.plot?.fourAct2 || '',
      fourAct3: currentProject.plot?.fourAct3 || '',
      fourAct4: currentProject.plot?.fourAct4 || '',
      // ヒーローズ・ジャーニー
      hj1: currentProject.plot?.hj1 || '',
      hj2: currentProject.plot?.hj2 || '',
      hj3: currentProject.plot?.hj3 || '',
      hj4: currentProject.plot?.hj4 || '',
      hj5: currentProject.plot?.hj5 || '',
      hj6: currentProject.plot?.hj6 || '',
      hj7: currentProject.plot?.hj7 || '',
      hj8: currentProject.plot?.hj8 || '',
      // ビートシート
      bs1: currentProject.plot?.bs1 || '',
      bs2: currentProject.plot?.bs2 || '',
      bs3: currentProject.plot?.bs3 || '',
      bs4: currentProject.plot?.bs4 || '',
      bs5: currentProject.plot?.bs5 || '',
      bs6: currentProject.plot?.bs6 || '',
      bs7: currentProject.plot?.bs7 || '',
      // ミステリー・サスペンス
      ms1: currentProject.plot?.ms1 || '',
      ms2: currentProject.plot?.ms2 || '',
      ms3: currentProject.plot?.ms3 || '',
      ms4: currentProject.plot?.ms4 || '',
      ms5: currentProject.plot?.ms5 || '',
      ms6: currentProject.plot?.ms6 || '',
      ms7: currentProject.plot?.ms7 || '',
    });

    // 構成スタイルの更新
    // - 新しいプロジェクトの場合: 常に更新
    // - 保護期間中でない場合: 更新（AI生成による更新など）
    // - 保護期間中: 更新しない（ユーザーのドロップダウン操作を保護）
    if (currentProject.plot?.structure) {
      if (isNewProject || !structureChangeProtectionRef.current) {
        setPlotStructure(currentProject.plot.structure);
      }
    }
  }, [currentProject]);

  // フォームデータをリセット
  const resetFormData = useCallback((structure?: PlotStructureType) => {
    const targetStructure = structure || plotStructure;
    if (targetStructure === 'kishotenketsu') {
      setFormData(prev => ({
        ...prev,
        ki: '',
        sho: '',
        ten: '',
        ketsu: '',
      }));
    } else if (targetStructure === 'three-act') {
      setFormData(prev => ({
        ...prev,
        act1: '',
        act2: '',
        act3: '',
      }));
    } else if (targetStructure === 'four-act') {
      setFormData(prev => ({
        ...prev,
        fourAct1: '',
        fourAct2: '',
        fourAct3: '',
        fourAct4: '',
      }));
    } else if (targetStructure === 'heroes-journey') {
      setFormData(prev => ({
        ...prev,
        hj1: '',
        hj2: '',
        hj3: '',
        hj4: '',
        hj5: '',
        hj6: '',
        hj7: '',
        hj8: '',
      }));
    } else if (targetStructure === 'beat-sheet') {
      setFormData(prev => ({
        ...prev,
        bs1: '',
        bs2: '',
        bs3: '',
        bs4: '',
        bs5: '',
        bs6: '',
        bs7: '',
      }));
    } else if (targetStructure === 'mystery-suspense') {
      setFormData(prev => ({
        ...prev,
        ms1: '',
        ms2: '',
        ms3: '',
        ms4: '',
        ms5: '',
        ms6: '',
        ms7: '',
      }));
    }
  }, [plotStructure]);

  return {
    formData,
    setFormData,
    plotStructure,
    setPlotStructure: handleSetPlotStructure,
    isSaving,
    saveStatus,
    lastSaved,
    resetFormData,
  };
}

