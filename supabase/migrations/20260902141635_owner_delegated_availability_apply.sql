create function public.approve_and_apply_availability_plan(
  p_plan_id uuid,
  p_expected_revision integer,
  p_plan_hash text,
  p_apply_idempotency_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_approved jsonb;
  v_applied jsonb;
  v_status public.availability_plan_status;
begin
  select plan.status
  into v_status
  from public.availability_plans as plan
  where plan.id = p_plan_id;

  -- Preserve the base apply RPC's idempotent retry contract. The nested call
  -- still checks Owner membership, the exact hash, and the original key.
  if v_status = 'applied' then
    v_applied := public.apply_approved_availability_plan(
      p_plan_id,
      p_expected_revision,
      p_plan_hash,
      p_apply_idempotency_key
    );

    return v_applied || jsonb_build_object(
      'approval_mode', 'owner_prompt'
    );
  end if;

  -- Both calls run in this RPC's transaction. If apply fails, the approval and
  -- its audit record roll back with it, so delegated execution cannot leave a
  -- half-approved plan behind.
  v_approved := public.approve_availability_plan(
    p_plan_id,
    p_expected_revision,
    p_plan_hash
  );

  v_applied := public.apply_approved_availability_plan(
    p_plan_id,
    p_expected_revision,
    p_plan_hash,
    p_apply_idempotency_key
  );

  return v_applied || jsonb_build_object(
    'approval_mode', 'owner_prompt',
    'approved_at', v_approved ->> 'approved_at'
  );
end;
$$;

revoke all on function public.approve_and_apply_availability_plan(
  uuid,
  integer,
  text,
  uuid
) from public;

grant execute on function public.approve_and_apply_availability_plan(
  uuid,
  integer,
  text,
  uuid
) to authenticated;

comment on function public.approve_and_apply_availability_plan(
  uuid,
  integer,
  text,
  uuid
) is
  'Atomically records authenticated Owner approval for one exact prepared availability plan and applies it.';
