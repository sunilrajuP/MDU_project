import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  useGetSiteInfoQuery,
  useGetSurveyorJobQuery,
  useSaveSiteInfoMutation,
} from '@/api/surveyorApi';
import { PATHS } from '@/app/paths';
import type { GetSiteInfoResponse, SurveyorJobDetail } from '@/types/surveyor';
import { formatShortDate } from '../format';
import { toSiteInfo, toValues, validate, type SiteInfoErrors, type SiteInfoValues } from './siteInfoForm';
import styles from './SiteInfoPage.module.scss';

interface SiteInfoFormProps {
  jobRef: string;
  job: SurveyorJobDetail;
  data: GetSiteInfoResponse;
}

function SiteInfoForm({ jobRef, job, data }: Readonly<SiteInfoFormProps>) {
  const navigate = useNavigate();
  const [saveSiteInfo, { isLoading: saving }] = useSaveSiteInfoMutation();
  const [values, setValues] = useState<SiteInfoValues>(() => toValues(data.siteInfo));
  const [errors, setErrors] = useState<SiteInfoErrors>({});
  const [failed, setFailed] = useState(false);
  const busy = saving;

  const original = data.siteInfo;
  const tagFor = (flag?: boolean) => (flag ? 'from manager' : undefined);

  const set = (key: keyof SiteInfoValues) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setFailed(false);
    try {
      await saveSiteInfo({
        jobRef,
        clientRequestId: crypto.randomUUID(),
        baseRev: original.rev,
        siteInfo: toSiteInfo(values, original),
      }).unwrap();
    } catch {
      setFailed(true);
      return;
    }
    navigate(PATHS.SURVEYOR_JOB_OVERVIEW(jobRef));
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
      <p className={styles.context}>
        {job.jobRef} · {job.siteName} · Site visit {formatShortDate(job.scheduledDate)}
      </p>

      <Card className={styles.card}>
        <h2 className={styles.heading}>Stakeholder &amp; contact</h2>
        <div className={styles.grid}>
          <Input
            label="Stakeholder / role"
            tag={tagFor(original.stakeholder.role.fromManager)}
            value={values.role}
            onChange={(event) => set('role')(event.target.value)}
          />
          <Input
            label="Contact name"
            tag={tagFor(original.stakeholder.name.fromManager)}
            value={values.name}
            error={errors.name}
            onChange={(event) => set('name')(event.target.value)}
            autoComplete="name"
          />
          <div className={styles.full}>
            <Input
              label="Contact phone"
              tag={tagFor(original.stakeholder.phone.fromManager)}
              type="tel"
              inputMode="tel"
              value={values.phone}
              error={errors.phone}
              onChange={(event) => set('phone')(event.target.value)}
              autoComplete="tel"
            />
          </div>
          <div className={styles.full}>
            <Input
              label="Contact email"
              type="email"
              inputMode="email"
              value={values.email}
              error={errors.email}
              onChange={(event) => set('email')(event.target.value)}
              autoComplete="email"
            />
          </div>
        </div>
      </Card>

      <Card className={styles.card}>
        <h2 className={styles.heading}>Parking &amp; access</h2>
        <div className={styles.grid}>
          <Select
            label="Parking available"
            value={values.parking}
            onChange={(event) => set('parking')(event.target.value)}
            options={data.options.parking.map((option) => ({ value: option, label: option }))}
          />
          <Input
            label="Access window"
            value={values.accessWindow}
            onChange={(event) => set('accessWindow')(event.target.value)}
          />
          <div className={styles.full}>
            <Input
              label="Entry / access instructions"
              tag={tagFor(original.access.entryInstructions.fromManager)}
              value={values.entryInstructions}
              onChange={(event) => set('entryInstructions')(event.target.value)}
            />
          </div>
          <div className={styles.full}>
            <Input
              label="Access requirements"
              value={values.accessRequirements}
              onChange={(event) => set('accessRequirements')(event.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className={styles.card}>
        <h2 className={styles.heading}>Building information</h2>
        <div className={styles.grid}>
          <Input
            label="Building / Complex"
            value={values.buildingName}
            onChange={(event) => set('buildingName')(event.target.value)}
          />
          <Select
            label="Building type"
            value={values.buildingType}
            onChange={(event) => set('buildingType')(event.target.value)}
            options={data.options.buildingType.map((option) => ({ value: option, label: option }))}
          />
          <Select
            label="Ground"
            value={values.ground}
            onChange={(event) => set('ground')(event.target.value)}
            options={data.options.ground.map((option) => ({ value: option, label: option }))}
          />
        </div>
      </Card>

      {failed &&<Callout tone="danger">Your changes could not be saved. Please try again.</Callout>}

      <div className={styles.actionBar}>
        <Button type="submit" className={styles.wide} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

export function SiteInfoPage() {
  const { jobRef = '' } = useParams();
  const { data: job, isLoading: jobLoading, isError: jobError } = useGetSurveyorJobQuery(jobRef);
  const { data, isLoading: infoLoading, isError: infoError } = useGetSiteInfoQuery(jobRef);

  if (jobLoading || infoLoading) return <p role="status">Loading contacts &amp; access…</p>;
  if (jobError || infoError || !job || !data) {
    return (
      <Callout tone="danger">
        Contacts &amp; access could not be loaded. <Link to={PATHS.SURVEYOR_ROOT}>Back to My Jobs</Link>
      </Callout>
    );
  }
  return <SiteInfoForm jobRef={jobRef} job={job} data={data} />;
}
