export interface SendableMessageProperties {
	customTags?: Map<string, string>;
	repliesToLabel?: string;
	partOfBatch?: string;
}
