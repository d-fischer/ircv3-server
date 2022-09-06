export interface SendableMessageProperties {
	clientTags?: Map<string, string>;
	customTags?: Map<string, string>;
	repliesToLabel?: string;
	partOfBatch?: string;
}
