type PropRenameSchema = Record<string, string>;

export type RenameTypeProps<T extends Record<any, any>, schema extends PropRenameSchema> = {
	[k in keyof T as k extends keyof schema ? `${schema[k]}` : k]: T[k];
};

export const RenameProps = (o: Record<string, any>, schema: PropRenameSchema) => {
	
  const result: Record<string, any> = {};
	
  for (const key in o) 
		result[schema?.[key] || key] = o[key];
	
    return result;
};
