export const STANDARD_SCHEMA_VERSION = 1 as const;

export interface StandardIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<StandardPathSegment>;
}

export type StandardPathSegment = string | number;

export type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardIssue>; readonly value?: undefined };

export interface StandardVendor {
  readonly name: string;
  readonly url?: string;
  readonly [key: string]: unknown;
}

/**
 * Standard Schema 规范接口 v1
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    validate(
      value: unknown,
      info?: { readonly path?: ReadonlyArray<PropertyKey> },
    ): StandardResult<Output>;
    types?:
      | {
          readonly input?: Input;
          readonly output?: Output;
        }
      | undefined;
  }
}

export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
  Schema['~standard']['types']
>['input'];

export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
  Schema['~standard']['types']
>['output'];

export interface StandardJSONSchemaV1 extends StandardSchemaV1 {
  readonly '~standard': StandardSchemaV1.Props & {
    readonly vendor: 'json-schema';
    readonly jsonSchema: Readonly<Record<string, unknown>>;
  };
}

export interface StandardTypedV1<Input = unknown, Output = Input> extends StandardSchemaV1<
  Input,
  Output
> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output> & {
    readonly vendor: 'typescript';
  };
}
