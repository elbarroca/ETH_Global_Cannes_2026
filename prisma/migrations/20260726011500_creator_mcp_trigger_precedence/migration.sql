-- Repair PostgreSQL operator precedence in creator MCP binding ID validation.

CREATE OR REPLACE FUNCTION public.enforce_creator_manifest_mcp()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE binding JSONB;
DECLARE binding_ids TEXT[];
BEGIN
  IF NEW.manifest->>'schemaVersion' <> '2' THEN RETURN NEW; END IF;
  binding_ids := ARRAY(
    SELECT value->>'id'
    FROM jsonb_array_elements(NEW.manifest->'mcp') WITH ORDINALITY entry(value, ordinality)
    ORDER BY ordinality
  );
  FOR binding IN SELECT value FROM jsonb_array_elements(NEW.manifest->'mcp') value LOOP
    IF binding - ARRAY[
        'schemaVersion','id','provider','capability','access','timeoutMs','maxResponseBytes'
      ] <> '{}'::jsonb
      OR NOT (binding ?& ARRAY[
        'schemaVersion','id','provider','capability','access','timeoutMs','maxResponseBytes'
      ])
      OR binding->'schemaVersion' <> '1'::jsonb
      OR binding->>'access' <> 'read-only'
      OR binding->'timeoutMs' <> '8000'::jsonb
      OR binding->'maxResponseBytes' <> '32768'::jsonb
      OR (binding->>'id') <> ('mcp.' || (binding->>'provider') || '.' || (binding->>'capability'))
      OR NOT (
        (binding->>'provider' = 'coingecko'
          AND binding->>'capability' IN ('spot-price','market-snapshot'))
        OR (binding->>'provider' = 'the-graph'
          AND binding->>'capability' IN ('pinned-deployment-lookup','liquidity-volume-snapshot'))
      )
    THEN RAISE EXCEPTION 'creator manifest contains an unallowlisted MCP binding'
      USING ERRCODE = '23514'; END IF;
  END LOOP;
  IF cardinality(binding_ids) <> cardinality(ARRAY(SELECT DISTINCT unnest(binding_ids)))
    OR binding_ids IS DISTINCT FROM ARRAY(
      SELECT value->>'id' FROM jsonb_array_elements(NEW.manifest->'mcp') value
      ORDER BY CASE value->>'id'
        WHEN 'mcp.coingecko.spot-price' THEN 1
        WHEN 'mcp.coingecko.market-snapshot' THEN 2
        WHEN 'mcp.the-graph.pinned-deployment-lookup' THEN 3
        WHEN 'mcp.the-graph.liquidity-volume-snapshot' THEN 4
        ELSE 99
      END
    )
  THEN RAISE EXCEPTION 'creator manifest MCP bindings must be unique and server ordered'
    USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
